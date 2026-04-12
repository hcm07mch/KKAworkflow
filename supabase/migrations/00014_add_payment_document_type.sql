-- Migration: Add 'payment' document type
-- 입금 플로우별 문서를 생성하기 위해 payment 타입 추가

-- 1) workflow_project_documents.type CHECK 제약 갱신
ALTER TABLE workflow_project_documents
  DROP CONSTRAINT IF EXISTS workflow_documents_type_check;

ALTER TABLE workflow_project_documents
  ADD CONSTRAINT workflow_documents_type_check CHECK (
    type IN ('estimate', 'contract', 'pre_report', 'report', 'payment')
  );

-- 2) workflow_approval_policies.document_type CHECK 제약 갱신
ALTER TABLE workflow_approval_policies
  DROP CONSTRAINT IF EXISTS workflow_ap_document_type_check;

ALTER TABLE workflow_approval_policies
  ADD CONSTRAINT workflow_ap_document_type_check CHECK (
    document_type IS NULL OR document_type IN ('estimate', 'contract', 'pre_report', 'report', 'payment')
  );
