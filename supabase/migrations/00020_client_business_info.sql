-- =============================================================================
-- Migration: 고객사(workflow_clients) 사업자 정보 추가
--   - business_number: 사업자 등록번호 (10자리, 하이픈 포함 문자열 저장)
--   - business_registration_file_path: 사업자 등록증 파일 경로 (project-documents 버킷 내)
--   - business_registration_file_name: 원본 파일명
-- =============================================================================

ALTER TABLE workflow_clients
  ADD COLUMN IF NOT EXISTS business_number TEXT,
  ADD COLUMN IF NOT EXISTS business_registration_file_path TEXT,
  ADD COLUMN IF NOT EXISTS business_registration_file_name TEXT;

COMMENT ON COLUMN workflow_clients.business_number IS '사업자 등록번호';
COMMENT ON COLUMN workflow_clients.business_registration_file_path IS '사업자 등록증 파일 Storage 경로 (project-documents 버킷)';
COMMENT ON COLUMN workflow_clients.business_registration_file_name IS '사업자 등록증 원본 파일명';
