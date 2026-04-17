-- Drop the existing FK and re-add with ON DELETE SET NULL
ALTER TABLE workflow_project_assignees
  DROP CONSTRAINT workflow_project_assignees_assigned_by_fkey;

ALTER TABLE workflow_project_assignees
  ADD CONSTRAINT workflow_project_assignees_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES workflow_users(id) ON DELETE SET NULL;
