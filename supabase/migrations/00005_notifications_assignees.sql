-- ============================================================================
-- 00005: Notifications + Project Assignees
--
-- 1. workflow_project_assignees ? ?濡??몃? ?대뱀 諛곗
-- 2. workflow_notifications   ? ?由?(?濡????? 蹂寃???
-- ============================================================================

-- ============================================================================
-- 1. Project Assignees (N:N)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_project_assignees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES workflow_projects(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES workflow_users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member',         -- owner | member
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by   UUID REFERENCES workflow_users(id),
  UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_assignees_project ON workflow_project_assignees(project_id);
CREATE INDEX idx_project_assignees_user    ON workflow_project_assignees(user_id);

-- ============================================================================
-- 2. Notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES workflow_organizations(id) ON DELETE CASCADE,
  recipient_id    UUID NOT NULL REFERENCES workflow_users(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES workflow_projects(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,                           -- project_status_changed | document_created | approval_requested | approval_completed | assignee_added
  title           TEXT NOT NULL,
  body            TEXT,
  link            TEXT,                                    -- ?대┃ ? ?대? 寃쎈? (?: /projects/xxx)
  is_read         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient    ON workflow_notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_org          ON workflow_notifications(organization_id, created_at DESC);
CREATE INDEX idx_notifications_project      ON workflow_notifications(project_id);

-- ============================================================================
-- 3. RLS Policies
-- ============================================================================

ALTER TABLE workflow_project_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_notifications ENABLE ROW LEVEL SECURITY;

-- Assignees: 媛? 議곗? ?댁?留 議고/愿由?
CREATE POLICY "assignees_select" ON workflow_project_assignees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workflow_projects p
      WHERE p.id = project_id
        AND p.organization_id = get_current_user_organization_id()
    )
  );

CREATE POLICY "assignees_insert" ON workflow_project_assignees
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflow_projects p
      WHERE p.id = project_id
        AND p.organization_id = get_current_user_organization_id()
    )
  );

CREATE POLICY "assignees_delete" ON workflow_project_assignees
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workflow_projects p
      WHERE p.id = project_id
        AND p.organization_id = get_current_user_organization_id()
    )
  );

-- Notifications: 蹂몄몄 ?由쇰? 議고/??
CREATE POLICY "notifications_select" ON workflow_notifications
  FOR SELECT USING (
    recipient_id = (SELECT id FROM workflow_users WHERE auth_id = auth.uid())
  );

CREATE POLICY "notifications_update" ON workflow_notifications
  FOR UPDATE USING (
    recipient_id = (SELECT id FROM workflow_users WHERE auth_id = auth.uid())
  );

CREATE POLICY "notifications_insert" ON workflow_notifications
  FOR INSERT WITH CHECK (
    organization_id = get_current_user_organization_id()
  );
