-- Add 'monthly' payment type to workflow_projects and workflow_clients

ALTER TABLE workflow_projects
  DROP CONSTRAINT IF EXISTS workflow_projects_payment_type_check;

ALTER TABLE workflow_projects
  ADD CONSTRAINT workflow_projects_payment_type_check
  CHECK (payment_type IN ('deposit', 'per_invoice', 'monthly'));

ALTER TABLE workflow_clients
  DROP CONSTRAINT IF EXISTS workflow_clients_payment_type_check;

ALTER TABLE workflow_clients
  ADD CONSTRAINT workflow_clients_payment_type_check
  CHECK (payment_type IN ('deposit', 'per_invoice', 'monthly'));
