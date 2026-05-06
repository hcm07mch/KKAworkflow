-- Migration: 00026_workflow_segments
-- Purpose:
--   "워크플로우 세그먼트"를 1급 엔터티로 정규화한다.
--
--   기존 구조:
--     - workflow_projects.metadata.workflow_stack (jsonb 배열)
--     - workflow_project_documents.content.flow_number (jsonb 안의 정수)
--   기존 문제:
--     - 견적서 편집 시 content.flow_number 가 사라져 매핑이 깨짐
--     - PostgREST 임베드 순서가 환경 의존이라 폴백 인덱스 매칭이 비결정적
--     - 세그먼트(워크플로우 한 칸)라는 도메인 개념이 DB에 없어 응용 코드가 추론에 의존
--
--   본 마이그레이션은:
--     1) workflow_project_segments 테이블 도입 (1급 엔터티)
--     2) workflow_project_documents.segment_id FK 추가 (ON DELETE SET NULL)
--        - 전환기 동안 트리거가 재구축할 때 문서가 cascade 삭제되지 않도록 SET NULL 사용
--     3) 기존 데이터 백필 (멱등)
--     4) 양방향 동기화 트리거
--        - workflow_projects.metadata.workflow_stack 변경 → segments 재구축
--        - segments 변경 → workflow_projects.metadata.workflow_stack / status 갱신
--        - 새 문서 INSERT 시 content.flow_number 로 segment_id 자동 부여
--     모든 트리거는 pg_trigger_depth() 가드를 두어 재귀 루프를 차단한다.

-- ============================================================
-- 0) Extension (gen_random_uuid)
-- ============================================================
-- 다른 마이그레이션에서 이미 활성화되어 있을 가능성이 높지만 멱등성을 위해 보장.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1) workflow_project_segments 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_project_segments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      uuid NOT NULL REFERENCES workflow_projects(id) ON DELETE CASCADE,

    -- 그룹 식별 (PROJECT_STATUS_GROUPS.key 와 동일: A/B/C/D/E/F/G/H)
    group_key       char(1) NOT NULL
        CHECK (group_key IN ('A','B','C','D','E','F','G','H')),

    -- 동일 프로젝트 내 순서 (0,1,2,…) — 빌더의 stack 인덱스와 1:1
    position        int NOT NULL,

    -- 동일 group_key 내 1-based 카운터 — 견적서 #1, #2 라벨과 1:1
    flow_number     int NOT NULL,

    -- 이 세그먼트의 현재 세부 상태 (예: 'B3_estimate_sent')
    current_status  text NOT NULL,

    -- 그룹별 부가정보 (입금 정보, 환불 사유 등) — 향후 확장 자리
    meta            jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    closed_at       timestamptz,

    UNIQUE (project_id, position),
    UNIQUE (project_id, group_key, flow_number)
);

CREATE INDEX IF NOT EXISTS idx_segments_project_position
    ON workflow_project_segments(project_id, position);
CREATE INDEX IF NOT EXISTS idx_segments_project_group_flow
    ON workflow_project_segments(project_id, group_key, flow_number);

COMMENT ON TABLE workflow_project_segments IS
    '워크플로우 스택의 한 칸. metadata.workflow_stack 의 정규화된 표현.';

-- ============================================================
-- 2) workflow_project_documents.segment_id FK
-- ============================================================
ALTER TABLE workflow_project_documents
    ADD COLUMN IF NOT EXISTS segment_id uuid
        REFERENCES workflow_project_segments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_doc_segment
    ON workflow_project_documents(segment_id);

-- ============================================================
-- 3) RLS — 프로젝트와 동일 정책 (조직 멤버이고 같은 organization 의 프로젝트)
-- ============================================================
ALTER TABLE workflow_project_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "segments_select_via_project" ON workflow_project_segments;
DROP POLICY IF EXISTS "segments_insert_via_project" ON workflow_project_segments;
DROP POLICY IF EXISTS "segments_update_via_project" ON workflow_project_segments;
DROP POLICY IF EXISTS "segments_delete_via_project" ON workflow_project_segments;

CREATE POLICY "segments_select_via_project"
    ON workflow_project_segments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workflow_projects p
            WHERE p.id = workflow_project_segments.project_id
              AND p.organization_id = get_current_user_organization_id()
        )
    );

CREATE POLICY "segments_insert_via_project"
    ON workflow_project_segments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workflow_projects p
            WHERE p.id = workflow_project_segments.project_id
              AND p.organization_id = get_current_user_organization_id()
        )
    );

CREATE POLICY "segments_update_via_project"
    ON workflow_project_segments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workflow_projects p
            WHERE p.id = workflow_project_segments.project_id
              AND p.organization_id = get_current_user_organization_id()
        )
    );

CREATE POLICY "segments_delete_via_project"
    ON workflow_project_segments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM workflow_projects p
            WHERE p.id = workflow_project_segments.project_id
              AND p.organization_id = get_current_user_organization_id()
        )
    );

-- ============================================================
-- 4) 백필 — 모든 기존 데이터에 자동 적용 (멱등)
-- ============================================================

-- 4-A) metadata.workflow_stack 을 펼쳐 segment row 생성
--      이미 segments 가 있는 프로젝트는 건너뜀.
INSERT INTO workflow_project_segments
    (project_id, group_key, position, flow_number, current_status)
SELECT
    p.id,
    LEFT(s.entry, 1) AS group_key,
    (s.ord - 1)::int AS position,
    ROW_NUMBER() OVER (
        PARTITION BY p.id, LEFT(s.entry, 1) ORDER BY s.ord
    )::int AS flow_number,
    s.entry AS current_status
FROM workflow_projects p
CROSS JOIN LATERAL jsonb_array_elements_text(
    COALESCE(p.metadata->'workflow_stack', '[]'::jsonb)
) WITH ORDINALITY AS s(entry, ord)
WHERE LEFT(s.entry, 1) IN ('A','B','C','D','E','F','G','H')
  AND NOT EXISTS (
      SELECT 1 FROM workflow_project_segments x WHERE x.project_id = p.id
  );

-- 4-B) workflow_stack 이 비었지만 status 만 있는 레거시 프로젝트:
--      현재 status 한 개짜리 segment 를 만든다.
INSERT INTO workflow_project_segments
    (project_id, group_key, position, flow_number, current_status)
SELECT p.id, LEFT(p.status, 1), 0, 1, p.status
FROM workflow_projects p
WHERE p.status IS NOT NULL
  AND LEFT(p.status, 1) IN ('A','B','C','D','E','F','G','H')
  AND NOT EXISTS (
      SELECT 1 FROM workflow_project_segments s WHERE s.project_id = p.id
  );

-- 4-C) 기존 문서에 segment_id 부여
--      매칭 우선순위: content.flow_number (있으면) → created_at 오름차순.
--      이미 segment_id 가 채워진 문서는 건너뜀.
WITH ranked_docs AS (
    SELECT d.id, d.project_id,
        CASE d.type
            WHEN 'estimate'   THEN 'B'
            WHEN 'contract'   THEN 'C'
            WHEN 'payment'    THEN 'D'
            WHEN 'pre_report' THEN 'E'
        END AS group_key,
        ROW_NUMBER() OVER (
            PARTITION BY d.project_id, d.type
            ORDER BY (d.content->>'flow_number')::int NULLS LAST, d.created_at
        ) AS rn
    FROM workflow_project_documents d
    WHERE d.segment_id IS NULL
      AND d.type IN ('estimate','contract','payment','pre_report')
)
UPDATE workflow_project_documents d
SET segment_id = s.id
FROM ranked_docs r
JOIN workflow_project_segments s
    ON s.project_id = r.project_id
   AND s.group_key  = r.group_key
   AND s.flow_number = r.rn
WHERE d.id = r.id;

-- ============================================================
-- 5) 양방향 동기화 트리거
-- ============================================================

-- 5-A) workflow_projects.metadata.workflow_stack 변경 → segments 재구축
--      구코드(stack 직접 PATCH 경로) 호환을 위해 필요.
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

    -- 단순/안전 전략: 해당 프로젝트의 segments 전체를 재구축한다.
    -- ON DELETE SET NULL 이므로 문서의 segment_id 만 잠시 NULL 이 되고,
    -- 아래 UPDATE 로 즉시 재연결된다.
    DELETE FROM workflow_project_segments WHERE project_id = NEW.id;

    INSERT INTO workflow_project_segments
        (project_id, group_key, position, flow_number, current_status)
    SELECT
        NEW.id,
        LEFT(s.entry, 1),
        (s.ord - 1)::int,
        ROW_NUMBER() OVER (
            PARTITION BY LEFT(s.entry, 1) ORDER BY s.ord
        )::int,
        s.entry
    FROM jsonb_array_elements_text(new_stack) WITH ORDINALITY AS s(entry, ord)
    WHERE LEFT(s.entry, 1) IN ('A','B','C','D','E','F','G','H');

    -- 문서 재연결: content.flow_number 우선, 없으면 created_at 순서.
    WITH ranked_docs AS (
        SELECT d.id,
            CASE d.type
                WHEN 'estimate'   THEN 'B'
                WHEN 'contract'   THEN 'C'
                WHEN 'payment'    THEN 'D'
                WHEN 'pre_report' THEN 'E'
            END AS group_key,
            ROW_NUMBER() OVER (
                PARTITION BY d.type
                ORDER BY (d.content->>'flow_number')::int NULLS LAST, d.created_at
            ) AS rn
        FROM workflow_project_documents d
        WHERE d.project_id = NEW.id
          AND d.type IN ('estimate','contract','payment','pre_report')
    )
    UPDATE workflow_project_documents d
    SET segment_id = s.id
    FROM ranked_docs r
    JOIN workflow_project_segments s
        ON s.project_id = NEW.id
       AND s.group_key  = r.group_key
       AND s.flow_number = r.rn
    WHERE d.id = r.id;

    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_sync_segments_from_stack ON workflow_projects;
CREATE TRIGGER trg_sync_segments_from_stack
    AFTER UPDATE OF metadata ON workflow_projects
    FOR EACH ROW
    EXECUTE FUNCTION sync_segments_from_stack();

-- 5-B) 새 문서가 segment_id 없이 INSERT 되면 content.flow_number 로 자동 부여
--      구코드(/api/documents POST 경로) 호환을 위해 필요.
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

    gk := CASE NEW.type
            WHEN 'estimate'   THEN 'B'
            WHEN 'contract'   THEN 'C'
            WHEN 'payment'    THEN 'D'
            WHEN 'pre_report' THEN 'E'
          END;
    IF gk IS NULL THEN
        RETURN NEW;
    END IF;

    fn := COALESCE((NEW.content->>'flow_number')::int, 1);

    SELECT id INTO NEW.segment_id
    FROM workflow_project_segments
    WHERE project_id = NEW.project_id
      AND group_key  = gk
      AND flow_number = fn;

    -- 매칭되는 segment 가 없어도(타이밍 이슈 등) 실패시키지 않는다.
    -- 이후 5-A 트리거가 stack 갱신 시 재연결한다.
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_fill_document_segment ON workflow_project_documents;
CREATE TRIGGER trg_fill_document_segment
    BEFORE INSERT ON workflow_project_documents
    FOR EACH ROW
    EXECUTE FUNCTION fill_document_segment();

-- 5-C) segments 변경 → workflow_projects.metadata.workflow_stack / status 갱신
--      신코드(segments 직접 조작 경로)에 대비. 현재는 호출되지 않지만 PR #3 에서 사용.
CREATE OR REPLACE FUNCTION sync_stack_from_segments()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    pid uuid;
    new_stack jsonb;
    new_status text;
BEGIN
    -- 트리거 재귀 차단 (projects 변경 → segments 재구축 → 다시 이 트리거)
    IF pg_trigger_depth() > 1 THEN
        RETURN NULL;
    END IF;

    pid := COALESCE(NEW.project_id, OLD.project_id);

    SELECT jsonb_agg(current_status ORDER BY position)
    INTO new_stack
    FROM workflow_project_segments
    WHERE project_id = pid;

    SELECT current_status
    INTO new_status
    FROM workflow_project_segments
    WHERE project_id = pid
    ORDER BY position DESC
    LIMIT 1;

    UPDATE workflow_projects
    SET metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{workflow_stack}',
            COALESCE(new_stack, '[]'::jsonb)
        ),
        status = COALESCE(new_status, status)
    WHERE id = pid;

    RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS trg_sync_stack_from_segments ON workflow_project_segments;
CREATE TRIGGER trg_sync_stack_from_segments
    AFTER INSERT OR UPDATE OR DELETE ON workflow_project_segments
    FOR EACH ROW
    EXECUTE FUNCTION sync_stack_from_segments();

-- ============================================================
-- 6) 검증 (수동 확인용 — 실행 후 결과를 스크립트 외부에서 확인)
-- ============================================================
-- 다음 쿼리는 마이그레이션 후 콘솔에서 직접 돌려 0 행이 나오는지 확인하시오.
--
-- -- (a) 그룹별 문서 수 vs 세그먼트 수 불일치 프로젝트
SELECT p.id,
       d.type,
       COUNT(d.*) AS docs,
       (SELECT COUNT(*) FROM workflow_project_segments s
        WHERE s.project_id = p.id
          AND s.group_key = CASE d.type
              WHEN 'estimate'   THEN 'B'
              WHEN 'contract'   THEN 'C'
              WHEN 'payment'    THEN 'D'
              WHEN 'pre_report' THEN 'E' END) AS segs
FROM workflow_projects p
JOIN workflow_project_documents d ON d.project_id = p.id
WHERE d.type IN ('estimate','contract','payment','pre_report')
GROUP BY p.id, d.type
HAVING COUNT(d.*) <> (SELECT COUNT(*) FROM workflow_project_segments s
    WHERE s.project_id = p.id
      AND s.group_key = CASE d.type
          WHEN 'estimate'   THEN 'B'
          WHEN 'contract'   THEN 'C'
          WHEN 'payment'    THEN 'D'
          WHEN 'pre_report' THEN 'E' END);
--
-- -- (b) segment_id 가 비어있는 estimate/contract/payment/pre_report 문서
-- SELECT id, project_id, type
-- FROM workflow_project_documents
-- WHERE segment_id IS NULL
--   AND type IN ('estimate','contract','payment','pre_report');
