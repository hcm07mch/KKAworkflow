-- ============================================================================
-- Migration 00008: payment_type를 프로젝트 레벨로 추가
-- service_type은 이미 workflow_projects에 존재하므로 payment_type만 추가
-- ============================================================================

ALTER TABLE workflow_projects
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'deposit';

ALTER TABLE workflow_projects
  ADD CONSTRAINT workflow_projects_payment_type_check
  CHECK (payment_type IN ('deposit', 'per_invoice'));
