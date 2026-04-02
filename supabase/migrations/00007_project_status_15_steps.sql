-- ============================================================================
-- 00007: 프로젝트 상태 15단계 전환 + 상태 변경 히스토리
--
-- 기존 10개 상태 → 15개 세분화 상태로 변경
-- A: 영업
-- B: 견적 (B1~B4)
-- C: 계약 (C1~C4)
-- D: 입금 (D1~D2)
-- E: 집행 (E1~E4)
--
-- 또한 상태 변경 이력을 기록하는 workflow_project_status_history 테이블 추가
-- ============================================================================

-- 1. 기존 CHECK 제약조건 제거 후 새로운 15개 상태로 교체
ALTER TABLE workflow_projects
  DROP CONSTRAINT IF EXISTS workflow_projects_status_check;

ALTER TABLE workflow_projects
  ADD CONSTRAINT workflow_projects_status_check CHECK (
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
      'F2_closed'
    )
  );

-- 2. 기존 프로젝트 상태 마이그레이션 (기존 데이터가 있을 경우)
UPDATE workflow_projects SET status = 'A_sales'              WHERE status = 'draft';
UPDATE workflow_projects SET status = 'B3_estimate_sent'     WHERE status = 'quoted';
UPDATE workflow_projects SET status = 'B4_estimate_response' WHERE status = 'rejected';
UPDATE workflow_projects SET status = 'C4_contract_signed'   WHERE status = 'contracted';
UPDATE workflow_projects SET status = 'D2_payment_confirmed' WHERE status = 'paid';
UPDATE workflow_projects SET status = 'E4_execution'         WHERE status = 'running';
UPDATE workflow_projects SET status = 'E4_execution'         WHERE status = 'paused';
UPDATE workflow_projects SET status = 'E4_execution'         WHERE status = 'completed';
UPDATE workflow_projects SET status = 'D2_payment_confirmed' WHERE status = 'refunded';
UPDATE workflow_projects SET status = 'A_sales'              WHERE status = 'cancelled';

-- 3. 기본 상태값 변경
ALTER TABLE workflow_projects
  ALTER COLUMN status SET DEFAULT 'A_sales';

-- 4. 상태 변경 히스토리 테이블
CREATE TABLE IF NOT EXISTS workflow_project_status_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES workflow_projects(id) ON DELETE CASCADE,
  from_status   TEXT NOT NULL,
  to_status     TEXT NOT NULL,
  changed_by    UUID REFERENCES workflow_users(id) ON DELETE SET NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_project ON workflow_project_status_history(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_history_user    ON workflow_project_status_history(changed_by);

-- 5. RLS for status history
ALTER TABLE workflow_project_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "status_history_select" ON workflow_project_status_history;
CREATE POLICY "status_history_select" ON workflow_project_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workflow_projects p
      WHERE p.id = project_id
        AND p.organization_id = get_current_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "status_history_insert" ON workflow_project_status_history;
CREATE POLICY "status_history_insert" ON workflow_project_status_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflow_projects p
      WHERE p.id = project_id
        AND p.organization_id = get_current_user_organization_id()
    )
  );
