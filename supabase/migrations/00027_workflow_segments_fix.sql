-- Migration: 00027_workflow_segments_fix
-- Purpose:
--   00026 의 백필/트리거 로직 버그 수정.
--
--   버그:
--     기존 로직은 workflow_stack 의 "엔트리 하나하나"를 별도 segment 로 만들었다.
--     그러나 애플리케이션의 getGroupSegments() 는 동일 그룹의 "연속된 엔트리"를
--     하나의 세그먼트로 합친다.
--
--     예) stack = [A_sales, B1_estimate_draft, B2_estimate_review, B3_estimate_sent]
--       - 앱 기준: A 1개 + B 1개  (총 2 segments)
--       - 기존 백필: A 1개 + B 3개 (총 4 segments) ← 버그
--
--   본 마이그레이션은:
--     1) sync_segments_from_stack() 함수를 연속 엔트리 통합 버전으로 교체
--     2) 모든 segments 를 삭제 (segment_id 는 ON DELETE SET NULL 로 자동 NULL)
--     3) 통합 로직으로 재백필
--     4) 문서 segment_id 재연결
--
--   안전성: 멱등. ON DELETE SET NULL 이므로 문서 자체는 삭제되지 않는다.
--          트리거(5-A,5-B,5-C)는 그대로 유지됨. 함수만 교체.

-- ============================================================
-- 1) sync_segments_from_stack 함수 교체 (연속 엔트리 통합 버전)
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

    -- 연속 엔트리 통합 알고리즘:
    --   1) stack 을 ordinality 와 함께 펼친다.
    --   2) 직전 행의 group_key 와 현재 group_key 가 다르면 새 세그먼트 시작.
    --   3) 누적합으로 segment id 를 부여.
    --   4) 각 segment 의 마지막 엔트리를 current_status 로 사용.
    INSERT INTO workflow_project_segments
        (project_id, group_key, position, flow_number, current_status)
    WITH expanded AS (
        SELECT
            s.entry,
            s.ord,
            LEFT(s.entry, 1) AS gk
        FROM jsonb_array_elements_text(new_stack) WITH ORDINALITY AS s(entry, ord)
        WHERE LEFT(s.entry, 1) IN ('A','B','C','D','E','F','G','H')
    ),
    marked AS (
        SELECT
            entry, ord, gk,
            CASE
                WHEN LAG(gk) OVER (ORDER BY ord) IS DISTINCT FROM gk THEN 1
                ELSE 0
            END AS is_new
        FROM expanded
    ),
    segmented AS (
        SELECT
            entry, ord, gk,
            SUM(is_new) OVER (ORDER BY ord) AS seg_no
        FROM marked
    ),
    aggregated AS (
        SELECT
            gk AS group_key,
            seg_no,
            MIN(ord) AS min_ord,
            -- 세그먼트 내 마지막 엔트리를 current_status 로
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

-- ============================================================
-- 2) 잘못 생성된 segments 모두 삭제
--    ON DELETE SET NULL 이므로 문서의 segment_id 는 자동으로 NULL.
--    트리거 5-C(sync_stack_from_segments)는 트랜잭션 내에서 작동하지만
--    pg_trigger_depth 가드가 있고 새 stack 이 빈 배열이 되어도 어차피
--    아래 단계에서 다시 채워지므로 일관성 영향 없음.
-- ============================================================
-- 트리거 5-C 가 stack 을 비우지 않도록 잠시 비활성화.
ALTER TABLE workflow_project_segments DISABLE TRIGGER trg_sync_stack_from_segments;

DELETE FROM workflow_project_segments;

-- ============================================================
-- 3) 통합 로직으로 재백필
-- ============================================================

-- 3-A) 모든 프로젝트의 workflow_stack 을 통합 알고리즘으로 segments 생성
INSERT INTO workflow_project_segments
    (project_id, group_key, position, flow_number, current_status)
WITH expanded AS (
    SELECT
        p.id AS project_id,
        s.entry,
        s.ord,
        LEFT(s.entry, 1) AS gk
    FROM workflow_projects p
    CROSS JOIN LATERAL jsonb_array_elements_text(
        COALESCE(p.metadata->'workflow_stack', '[]'::jsonb)
    ) WITH ORDINALITY AS s(entry, ord)
    WHERE LEFT(s.entry, 1) IN ('A','B','C','D','E','F','G','H')
),
marked AS (
    SELECT
        project_id, entry, ord, gk,
        CASE
            WHEN LAG(gk) OVER (PARTITION BY project_id ORDER BY ord) IS DISTINCT FROM gk THEN 1
            ELSE 0
        END AS is_new
    FROM expanded
),
segmented AS (
    SELECT
        project_id, entry, ord, gk,
        SUM(is_new) OVER (PARTITION BY project_id ORDER BY ord) AS seg_no
    FROM marked
),
aggregated AS (
    SELECT
        project_id,
        gk AS group_key,
        seg_no,
        MIN(ord) AS min_ord,
        (ARRAY_AGG(entry ORDER BY ord DESC))[1] AS current_status
    FROM segmented
    GROUP BY project_id, gk, seg_no
)
SELECT
    project_id,
    group_key,
    (ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY min_ord) - 1)::int AS position,
    ROW_NUMBER() OVER (PARTITION BY project_id, group_key ORDER BY min_ord)::int AS flow_number,
    current_status
FROM aggregated;

-- 3-B) workflow_stack 이 비었지만 status 만 있는 레거시 프로젝트 보정
INSERT INTO workflow_project_segments
    (project_id, group_key, position, flow_number, current_status)
SELECT p.id, LEFT(p.status, 1), 0, 1, p.status
FROM workflow_projects p
WHERE p.status IS NOT NULL
  AND LEFT(p.status, 1) IN ('A','B','C','D','E','F','G','H')
  AND NOT EXISTS (
      SELECT 1 FROM workflow_project_segments s WHERE s.project_id = p.id
  );

-- 3-C) 데이터 정합성 보정: stack 에는 없지만 문서가 존재하는 그룹은
--      해당 그룹 segment 를 마지막 위치에 추가하여 매핑 가능하게 한다.
--      (예: 과거에 세그먼트 삭제 후 문서만 남은 케이스)
WITH missing AS (
    SELECT
        d.project_id,
        CASE d.type
            WHEN 'estimate'   THEN 'B'
            WHEN 'contract'   THEN 'C'
            WHEN 'payment'    THEN 'D'
            WHEN 'pre_report' THEN 'E'
        END AS group_key,
        COUNT(*) AS doc_count
    FROM workflow_project_documents d
    WHERE d.type IN ('estimate','contract','payment','pre_report')
    GROUP BY d.project_id, d.type
),
gaps AS (
    SELECT
        m.project_id,
        m.group_key,
        m.doc_count,
        COALESCE(
            (SELECT COUNT(*) FROM workflow_project_segments s
             WHERE s.project_id = m.project_id AND s.group_key = m.group_key),
            0
        ) AS seg_count
    FROM missing m
),
need AS (
    SELECT project_id, group_key, doc_count, seg_count,
           generate_series(seg_count + 1, doc_count) AS flow_number
    FROM gaps
    WHERE doc_count > seg_count
),
positioned AS (
    SELECT
        n.project_id,
        n.group_key,
        n.flow_number,
        -- 새 segment 들을 기존 segments 뒤에 차례로 붙임
        COALESCE((SELECT MAX(position) FROM workflow_project_segments s
                  WHERE s.project_id = n.project_id), -1)
            + ROW_NUMBER() OVER (PARTITION BY n.project_id ORDER BY n.group_key, n.flow_number) AS position
    FROM need n
)
INSERT INTO workflow_project_segments
    (project_id, group_key, position, flow_number, current_status)
SELECT
    project_id,
    group_key,
    position,
    flow_number,
    -- current_status 는 그룹의 마지막(=완료) 세부 상태로 추정
    CASE group_key
        WHEN 'B' THEN 'B3_estimate_sent'
        WHEN 'C' THEN 'C3_contract_sent'
        WHEN 'D' THEN 'D2_payment_confirmed'
        WHEN 'E' THEN 'E3_prereport_sent'
    END
FROM positioned;

-- ============================================================
-- 4) 문서 segment_id 재연결
-- ============================================================
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
    WHERE d.type IN ('estimate','contract','payment','pre_report')
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
-- 5) 트리거 5-C 재활성화
-- ============================================================
ALTER TABLE workflow_project_segments ENABLE TRIGGER trg_sync_stack_from_segments;

-- ============================================================
-- 6) 검증 (실행 후 콘솔에서 다음 쿼리로 0 행 확인)
-- ============================================================
-- (a) 그룹별 문서 수 vs 세그먼트 수 불일치 (0 행이어야 함)
-- SELECT p.id, d.type,
--        COUNT(d.*) AS docs,
--        (SELECT COUNT(*) FROM workflow_project_segments s
--         WHERE s.project_id = p.id
--           AND s.group_key = CASE d.type
--               WHEN 'estimate'   THEN 'B'
--               WHEN 'contract'   THEN 'C'
--               WHEN 'payment'    THEN 'D'
--               WHEN 'pre_report' THEN 'E' END) AS segs
-- FROM workflow_projects p
-- JOIN workflow_project_documents d ON d.project_id = p.id
-- WHERE d.type IN ('estimate','contract','payment','pre_report')
-- GROUP BY p.id, d.type
-- HAVING COUNT(d.*) <> (SELECT COUNT(*) FROM workflow_project_segments s
--     WHERE s.project_id = p.id
--       AND s.group_key = CASE d.type
--           WHEN 'estimate'   THEN 'B'
--           WHEN 'contract'   THEN 'C'
--           WHEN 'payment'    THEN 'D'
--           WHEN 'pre_report' THEN 'E' END);

-- (b) segment_id 가 비어있는 문서 (0 행이어야 함)
-- SELECT id, project_id, type FROM workflow_project_documents
-- WHERE segment_id IS NULL
--   AND type IN ('estimate','contract','payment','pre_report');

-- (c) 통합이 잘 됐는지 샘플 확인 — 한 프로젝트의 segments 가 stack 과 일치하는지
-- SELECT p.id, p.metadata->'workflow_stack' AS stack,
--        (SELECT jsonb_agg(jsonb_build_object('pos', position, 'gk', group_key, 'fn', flow_number, 'cur', current_status) ORDER BY position)
--         FROM workflow_project_segments s WHERE s.project_id = p.id) AS segments
-- FROM workflow_projects p
-- LIMIT 5;
