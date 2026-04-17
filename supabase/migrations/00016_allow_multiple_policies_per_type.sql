-- Allow multiple approval policies per (organization_id, document_type)
-- The application now supports selecting an active policy via radio buttons
ALTER TABLE workflow_approval_policies
  DROP CONSTRAINT IF EXISTS workflow_ap_org_type_unique;
