-- Migration: 00028_segments_extensible
-- Purpose:
--   00026/00027 의 segments 구조를 "플로우 변경에 강한" 형태로 정리한다.
--
--   변경 사항:
--     1) group_key 의 CHECK 제약 제거. (그룹 추가 시 마이그레이션 불필요.)
--        검증은 도메인 코드(PROJECT_STATUS_GROUPS) 한 곳에서만 수행.
--     2) DB 헬퍼 함수 document_type_to_group_key(text) 도입.
--        트리거들이 이 함수만 호출하므로, 새 문서 타입 ↔ 그룹 매핑이 늘어나도
--        함수만 갱신하면 된다.
--     3) 트리거 5-A / 5-B 를 헬퍼 함수 사용 버전으로 교체.
--     4) 트리거 5-A 끝에 "segment_id 가 NULL 로 남은 문서를 마지막 segment 에
--        붙여주는" 폴백을 추가하여 고아 문서를 줄인다.
--
--   안전성: 멱등. 데이터 변경 없음. 함수/트리거/제약만 교체.

-- ============================================================
-- 1) group_key CHECK 제약 제거
-- ============================================================
ALTER TABLE workflow_project_segments
    DROP CONSTRAINT IF EXISTS workflow_project_segments_group_key_check;

COMMENT ON COLUMN workflow_project_segments.group_key IS
    '그룹 식별자(1글자). 검증은 애플리케이션의 PROJECT_STATUS_GROUPS 한 곳에서 수행한다.';

-- ============================================================
-- 2) 헬퍼 함수 — 문서 타입 → 그룹 키
-- ============================================================
-- 새 타입 추가 시 본 함수만 수정하면 트리거/백필 양쪽이 자동 반영된다.
CREATE OR REPLACE FUNCTION document_type_to_group_key(doc_type text)
RETURNS char(1)
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE doc_type
        WHEN 'estimate'   THEN 'B'
        WHEN 'contract'   THEN 'C'
        WHEN 'payment'    THEN 'D'
        WHEN 'pre_report' THEN 'E'
    END::char(1);
$$;

COMMENT ON FUNCTION document_type_to_group_key(text) IS
    '문서 타입 → 워크플로우 그룹 키 매핑. 매칭되지 않으면 NULL.';

-- ============================================================
-- 3) sync_segments_from_stack — 헬퍼 함수 사용 + 고아 문서 폴백
-- ============================================================
CREATE OR REPLACE FUNCTION sync_segments_from_stack()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_stack jsonb := COALESCE(OLD.metadata->'workflow_stack', '[]'::jsonb);
    new_stack jsonb := COALESCE(NEW.metadata->'workflow_stack', '[]'::jsonb);
BEGIN
    -- 트리거 재귀 차단 (segments 변경 → projects 변경 → 다시 이 트리거)
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF old_stack IS NOT DISTINCT FROM new_stack THEN
        RETURN NEW;
    END IF;

    -- segments 전체 재구축. ON DELETE SET NULL 이므로 문서는 보존됨.
    DELETE FROM workflow_project_segments WHERE project_id = NEW.id;

    -- 연속 엔트리 통합 알고리즘으로 segments 재생성.
    -- group_key 화이트리스트는 더 이상 SQL 에 두지 않는다 (CHECK 제거).
    -- 단, 빈 문자열/null 만 방어.
    INSERT INTO workflow_project_segments
        (project_id, group_key, position, flow_number, current_status)
    WITH expanded AS (
        SELECT
            s.entry,
            s.ord,
            LEFT(s.entry, 1) AS gk
        FROM jsonb_array_elements_text(new_stack) WITH ORDINALITY AS s(entry, ord)
        WHERE s.entry IS NOT NULL AND length(s.entry) > 0
    ),
    marked AS (
        SELECT entry, ord, gk,
            CASE
                WHEN LAG(gk) OVER (ORDER BY ord) IS DISTINCT FROM gk THEN 1
                ELSE 0
            END AS is_new
        FROM expanded
    ),
    segmented AS (
        SELECT entry, ord, gk,
            SUM(is_new) OVER (ORDER BY ord) AS seg_no
        FROM marked
    ),
    aggregated AS (
        SELECT
            gk AS group_key,
            seg_no,
            MIN(ord) AS min_ord,
            (ARRAY_AGG(entry ORDER BY ord DESC))[1] AS current_status
        FROM segmented
        GROUP BY gk, seg_no
    )
    SELECT
        NEW.id,
        group_key,
        (ROW_NUMBER() OVER (ORDER BY min_ord) - 1)::int AS position,
        ROW_NUMBER() OVER (PARTITION BY group_key ORDER BY min_ord)::int AS flow_number,
        current_status
    FROM aggregated;

    -- 문서 재연결: 헬퍼 함수 사용. content.flow_number 우선, 없으면 created_at 순서.
    WITH ranked_docs AS (
        SELECT d.id,
            document_type_to_group_key(d.type) AS group_key,
            ROW_NUMBER() OVER (
                PARTITION BY d.type
                ORDER BY (d.content->>'flow_number')::int NULLS LAST, d.created_at
            ) AS rn
        FROM workflow_project_documents d
        WHERE d.project_id = NEW.id
          AND document_type_to_group_key(d.type) IS NOT NULL
    )
    UPDATE workflow_project_documents d
    SET segment_id = s.id
    FROM ranked_docs r
    JOIN workflow_project_segments s
        ON s.project_id = NEW.id
       AND s.group_key  = r.group_key
       AND s.flow_number = r.rn
    WHERE d.id = r.id;

    -- 고아 문서 폴백: 위 매칭에서 segment_id 가 채워지지 않은 문서들을
    -- 같은 그룹의 가장 마지막(최신) flow_number segment 에 붙인다.
    -- (segment 가 그룹에 아예 없으면 NULL 로 남음 — 이 경우는 데이터 무결성 정책에서
    --  PR #3 의 segment-aware write 경로가 INSERT 시점에 함께 생성하도록 처리.)
    UPDATE workflow_project_documents d
    SET segment_id = s.id
    FROM (
        SELECT DISTINCT ON (project_id, group_key)
            id, project_id, group_key
        FROM workflow_project_segments
        WHERE project_id = NEW.id
        ORDER BY project_id, group_key, flow_number DESC
    ) s
    WHERE d.project_id = NEW.id
      AND d.segment_id IS NULL
      AND document_type_to_group_key(d.type) = s.group_key;

    RETURN NEW;
END
$$;

-- ============================================================
-- 4) fill_document_segment — 헬퍼 함수 사용
-- ============================================================
CREATE OR REPLACE FUNCTION fill_document_segment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    gk char(1);
    fn int;
BEGIN
    IF NEW.segment_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    gk := document_type_to_group_key(NEW.type);
    IF gk IS NULL THEN
        RETURN NEW;
    END IF;

    fn := COALESCE((NEW.content->>'flow_number')::int, 1);

    SELECT id INTO NEW.segment_id
    FROM workflow_project_segments
    WHERE project_id = NEW.project_id
      AND group_key  = gk
      AND flow_number = fn;

    -- 정확 매칭이 없으면 같은 그룹의 가장 마지막 flow_number segment 에 폴백.
    IF NEW.segment_id IS NULL THEN
        SELECT id INTO NEW.segment_id
        FROM workflow_project_segments
        WHERE project_id = NEW.project_id
          AND group_key  = gk
        ORDER BY flow_number DESC
        LIMIT 1;
    END IF;

    RETURN NEW;
END
$$;

-- ============================================================
-- 5) 검증 (실행 후 콘솔에서 다음 쿼리로 확인)
-- ============================================================
-- (a) 헬퍼 함수 동작 확인
SELECT
  document_type_to_group_key('estimate')   AS estimate_gk,   -- B
  document_type_to_group_key('contract')   AS contract_gk,   -- C
  document_type_to_group_key('payment')    AS payment_gk,    -- D
  document_type_to_group_key('pre_report') AS prereport_gk,  -- E
  document_type_to_group_key('unknown')    AS unknown_gk;    -- NULL

-- (b) CHECK 제약 제거 확인
--     contype = 'c' 만 CHECK. UNIQUE/FK/PK 등은 제외.
SELECT conname FROM pg_constraint
WHERE conrelid = 'workflow_project_segments'::regclass
  AND contype = 'c'
  AND conname LIKE '%group_key%';
→ 0 행이어야 함.

-- 참고: 아래 UNIQUE 제약은 유지되어야 한다 (1행 노출이 정상).
-- SELECT conname FROM pg_constraint
-- WHERE conrelid = 'workflow_project_segments'::regclass
--   AND contype = 'u';
-- → workflow_project_segments_project_id_group_key_flow_number_key
