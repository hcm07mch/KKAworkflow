-- seed 데이터 전체 삭제 (외래키 의존관계 순서)
DELETE FROM workflow_project_assignees;
DELETE FROM workflow_notifications;
DELETE FROM workflow_approval_policy_steps;
DELETE FROM workflow_approval_policies;
DELETE FROM workflow_document_approvals;
DELETE FROM workflow_activity_logs;
DELETE FROM workflow_project_documents;
DELETE FROM workflow_projects;
DELETE FROM workflow_clients;
DELETE FROM workflow_users;
