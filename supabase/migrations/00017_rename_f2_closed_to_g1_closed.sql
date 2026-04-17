-- ============================================================================
-- 00017: F2_closed → G1_closed 마이그레이션
--
-- 환불(F)과 종료(G)를 DB상에서도 별도 그룹으로 분리
-- ============================================================================

-- 1) 기존 CHECK 제약 조건 제거
ALTER TABLE workflow_projects DROP CONSTRAINT IF EXISTS workflow_projects_status_check;

-- 2) 기존 데이터 업데이트 (제약 조건 없는 상태에서)
UPDATE workflow_projects SET status = 'G1_closed' WHERE status = 'F2_closed';

UPDATE workflow_project_status_history
  SET from_status = 'G1_closed' WHERE from_status = 'F2_closed';
UPDATE workflow_project_status_history
  SET to_status = 'G1_closed' WHERE to_status = 'F2_closed';

UPDATE workflow_status_check_types
  SET status = 'G1_closed', description = '프로젝트 종료'
  WHERE status = 'F2_closed';

-- 3) 새 CHECK 제약 조건 생성 (G1_closed 포함)
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
    'E4_execution',
    'F1_refund',
    'G1_closed'
  )
);
