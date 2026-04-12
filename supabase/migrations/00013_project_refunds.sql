-- ============================================================================
-- 00013: 프로젝트 환불 테이블
--
-- 프로젝트 종료 시 환불 과정이 포함되는 경우 환불 금액 및 사유를 기록
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_project_refunds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES workflow_projects(id) ON DELETE CASCADE,
  amount        NUMERIC(15, 2) NOT NULL,
  reason        TEXT,
  created_by    UUID REFERENCES workflow_users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_refunds_project ON workflow_project_refunds(project_id);

-- RLS
ALTER TABLE workflow_project_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refunds_select" ON workflow_project_refunds;
CREATE POLICY "refunds_select" ON workflow_project_refunds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workflow_projects p
      WHERE p.id = project_id
        AND p.organization_id = get_current_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "refunds_insert" ON workflow_project_refunds;
CREATE POLICY "refunds_insert" ON workflow_project_refunds
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflow_projects p
      WHERE p.id = project_id
        AND p.organization_id = get_current_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "refunds_update" ON workflow_project_refunds;
CREATE POLICY "refunds_update" ON workflow_project_refunds
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workflow_projects p
      WHERE p.id = project_id
        AND p.organization_id = get_current_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "refunds_delete" ON workflow_project_refunds;
CREATE POLICY "refunds_delete" ON workflow_project_refunds
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workflow_projects p
      WHERE p.id = project_id
        AND p.organization_id = get_current_user_organization_id()
    )
  );
