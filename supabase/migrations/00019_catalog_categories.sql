-- ============================================================================
-- Catalog Categories — 카탈로그 카테고리 테이블
-- Version: 1.0.0
-- Description: 견적서/집행 카탈로그의 카테고리를 별도 테이블로 관리.
--              workflow_service_catalog.group_name 대신 FK로 참조.
-- ============================================================================

-- 1. 카테고리 테이블 생성
CREATE TABLE workflow_catalog_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES workflow_organizations(id) ON DELETE CASCADE,
    catalog_type TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT workflow_catalog_categories_type_check CHECK (
        catalog_type IN ('estimate', 'execution')
    ),
    CONSTRAINT workflow_catalog_categories_unique UNIQUE (organization_id, catalog_type, name)
);

CREATE INDEX idx_workflow_catalog_categories_org
    ON workflow_catalog_categories(organization_id, catalog_type);

-- 2. 카탈로그 테이블에 category_id FK 추가
ALTER TABLE workflow_service_catalog
    ADD COLUMN category_id UUID REFERENCES workflow_catalog_categories(id) ON DELETE SET NULL;

-- 3. 기존 group_name 데이터를 카테고리로 마이그레이션
INSERT INTO workflow_catalog_categories (organization_id, catalog_type, name, sort_order)
SELECT DISTINCT organization_id, catalog_type, group_name, 0
FROM workflow_service_catalog
WHERE group_name IS NOT NULL AND group_name != ''
ON CONFLICT (organization_id, catalog_type, name) DO NOTHING;

UPDATE workflow_service_catalog sc
SET category_id = cc.id
FROM workflow_catalog_categories cc
WHERE sc.organization_id = cc.organization_id
  AND sc.catalog_type = cc.catalog_type
  AND sc.group_name = cc.name
  AND sc.group_name IS NOT NULL
  AND sc.group_name != '';

-- 4. RLS 정책
ALTER TABLE workflow_catalog_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_categories_select"
    ON workflow_catalog_categories FOR SELECT
    USING (
        organization_id IN (
            SELECT wu.organization_id FROM workflow_users wu
            WHERE wu.auth_id = auth.uid()
            UNION
            SELECT wo.parent_id FROM workflow_organizations wo
            JOIN workflow_users wu ON wu.organization_id = wo.id
            WHERE wu.auth_id = auth.uid() AND wo.parent_id IS NOT NULL
        )
    );

CREATE POLICY "catalog_categories_insert"
    ON workflow_catalog_categories FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT wu.organization_id FROM workflow_users wu
            WHERE wu.auth_id = auth.uid()
            AND wu.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "catalog_categories_update"
    ON workflow_catalog_categories FOR UPDATE
    USING (
        organization_id IN (
            SELECT wu.organization_id FROM workflow_users wu
            WHERE wu.auth_id = auth.uid()
            AND wu.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "catalog_categories_delete"
    ON workflow_catalog_categories FOR DELETE
    USING (
        organization_id IN (
            SELECT wu.organization_id FROM workflow_users wu
            WHERE wu.auth_id = auth.uid()
            AND wu.role IN ('admin', 'manager')
        )
    );
