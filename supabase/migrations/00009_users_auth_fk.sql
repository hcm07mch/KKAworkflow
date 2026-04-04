-- ============================================================================
-- Migration 00009: workflow_users.auth_id → auth.users(id) 외래키 추가
-- ============================================================================

ALTER TABLE workflow_users
  ADD CONSTRAINT workflow_users_auth_id_fkey
  FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE SET NULL;
