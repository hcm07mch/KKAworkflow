-- ============================================================================
-- 00018: 조직 계층 구조 (parent_id 기반)
--
-- workflow_organizations에 parent_id 추가 → 하위 조직 지원
-- workflow_users.organization_id로 소속 조직(하위) 구분
-- workflow_departments 테이블 제거
-- ============================================================================

-- 1) workflow_departments 테이블 제거 (이전에 생성된 경우)
DROP TABLE IF EXISTS workflow_departments CASCADE;

-- 2) workflow_users에서 department_id 컬럼 제거 (이전에 추가된 경우)
ALTER TABLE workflow_users DROP COLUMN IF EXISTS department_id;

-- 3) workflow_organizations에 parent_id 추가 (자기 참조 FK)
ALTER TABLE workflow_organizations
    ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES workflow_organizations(id) ON DELETE CASCADE;

-- 4) 인덱스: 하위 조직 조회 최적화
CREATE INDEX IF NOT EXISTS idx_workflow_organizations_parent_id
    ON workflow_organizations(parent_id);
