-- ============================================================================
-- 00025: 상태 그룹 재구성
--
-- E4_execution → F1_execution  (집행 → 별도 그룹 F)
-- F1_refund    → G1_refund     (환불 → 그룹 G)
-- G1_closed    → H1_closed     (종료 → 그룹 H)
--
-- E 그룹은 사전 보고서 단계만 포함 (E1, E2, E3)
-- ============================================================================

-- 1) 기존 CHECK 제약 조건 제거
ALTER TABLE workflow_projects DROP CONSTRAINT IF EXISTS workflow_projects_status_check;

-- 2) workflow_projects.status 업데이트 (제약 조건 없는 상태에서)
--    충돌(예: F1_refund → G1_refund 이전에 G1_closed 존재) 방지를 위해
--    종료 → 환불 → 집행 순서로 위에서부터 변환
UPDATE workflow_projects SET status = 'H1_closed'    WHERE status = 'G1_closed';
UPDATE workflow_projects SET status = 'G1_refund'    WHERE status = 'F1_refund';
UPDATE workflow_projects SET status = 'F1_execution' WHERE status = 'E4_execution';

-- 3) workflow_project_status_history 업데이트
UPDATE workflow_project_status_history SET from_status = 'H1_closed'    WHERE from_status = 'G1_closed';
UPDATE workflow_project_status_history SET to_status   = 'H1_closed'    WHERE to_status   = 'G1_closed';
UPDATE workflow_project_status_history SET from_status = 'G1_refund'    WHERE from_status = 'F1_refund';
UPDATE workflow_project_status_history SET to_status   = 'G1_refund'    WHERE to_status   = 'F1_refund';
UPDATE workflow_project_status_history SET from_status = 'F1_execution' WHERE from_status = 'E4_execution';
UPDATE workflow_project_status_history SET to_status   = 'F1_execution' WHERE to_status   = 'E4_execution';

-- 4) workflow_status_check_types 업데이트
--    기존 행을 새 키로 옮기되 동일 status 가 이미 있으면 충돌하므로 PK 변경 후 재삽입
DELETE FROM workflow_status_check_types WHERE status IN ('E4_execution', 'F1_refund', 'G1_closed');
INSERT INTO workflow_status_check_types (status, check_type, description) VALUES
  ('F1_execution', 'manual', '바이럴 및 광고 집행'),
  ('G1_refund',    'manual', '환불 처리'),
  ('H1_closed',    'manual', '프로젝트 종료')
ON CONFLICT (status) DO UPDATE SET
  check_type  = EXCLUDED.check_type,
  description = EXCLUDED.description,
  updated_at  = NOW();

-- 5) workflow_projects.metadata.workflow_stack 내 상태 코드 일괄 치환
UPDATE workflow_projects
SET metadata = jsonb_set(
  metadata,
  '{workflow_stack}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE elem #>> '{}'
          WHEN 'E4_execution' THEN to_jsonb('F1_execution'::text)
          WHEN 'F1_refund'    THEN to_jsonb('G1_refund'::text)
          WHEN 'G1_closed'    THEN to_jsonb('H1_closed'::text)
          ELSE elem
        END
      )
      FROM jsonb_array_elements(metadata->'workflow_stack') AS elem
    ),
    '[]'::jsonb
  ),
  false
)
WHERE jsonb_typeof(metadata->'workflow_stack') = 'array';

-- 6) 새 CHECK 제약 조건 생성
ALTER TABLE workflow_projects ADD CONSTRAINT workflow_projects_status_check CHECK (
  status IN (
    'A_sales',
    'B1_estimate_draft',
    'B2_estimate_review',
    'B3_estimate_sent',
    'B4_estimate_response',
    'C1_contract_draft',
    'C2_contract_review',
    'C3_contract_sent',
    'C4_contract_signed',
    'D1_payment_pending',
    'D2_payment_confirmed',
    'E1_prereport_draft',
    'E2_prereport_review',
    'E3_prereport_sent',
    'F1_execution',
    'G1_refund',
    'H1_closed'
  )
);
