-- Migration: 00022_catalog_rls_allow_member
-- Purpose:
--   1) API role check가 member로 완화됨에 따라 RLS의 role 제한을 제거.
--   2) 카탈로그/카테고리 쓰기(INSERT/UPDATE/DELETE)는 본사(root org, parent_id IS NULL)만 허용.
--      지사(하위 조직)는 오직 본사 동기화(sync-from-hq)를 통해서만 카탈로그를 받아갈 수 있음.

-- ============================================================
-- workflow_service_catalog
-- ============================================================
DROP POLICY IF EXISTS "service_catalog_insert" ON workflow_service_catalog;
DROP POLICY IF EXISTS "service_catalog_update" ON workflow_service_catalog;
DROP POLICY IF EXISTS "service_catalog_delete" ON workflow_service_catalog;

CREATE POLICY "service_catalog_insert" ON workflow_service_catalog
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT wu.organization_id
            FROM workflow_users wu
            JOIN workflow_organizations wo ON wo.id = wu.organization_id
            WHERE wu.auth_id = auth.uid() AND wo.parent_id IS NULL
        )
    );

CREATE POLICY "service_catalog_update" ON workflow_service_catalog
    FOR UPDATE USING (
        organization_id IN (
            SELECT wu.organization_id
            FROM workflow_users wu
            JOIN workflow_organizations wo ON wo.id = wu.organization_id
            WHERE wu.auth_id = auth.uid() AND wo.parent_id IS NULL
        )
    );

CREATE POLICY "service_catalog_delete" ON workflow_service_catalog
    FOR DELETE USING (
        organization_id IN (
            SELECT wu.organization_id
            FROM workflow_users wu
            JOIN workflow_organizations wo ON wo.id = wu.organization_id
            WHERE wu.auth_id = auth.uid() AND wo.parent_id IS NULL
        )
    );

-- ============================================================
-- workflow_catalog_links
-- ============================================================
DROP POLICY IF EXISTS "catalog_links_insert" ON workflow_catalog_links;
DROP POLICY IF EXISTS "catalog_links_delete" ON workflow_catalog_links;

CREATE POLICY "catalog_links_insert" ON workflow_catalog_links
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT wu.organization_id
            FROM workflow_users wu
            JOIN workflow_organizations wo ON wo.id = wu.organization_id
            WHERE wu.auth_id = auth.uid() AND wo.parent_id IS NULL
        )
    );

CREATE POLICY "catalog_links_delete" ON workflow_catalog_links
    FOR DELETE USING (
        organization_id IN (
            SELECT wu.organization_id
            FROM workflow_users wu
            JOIN workflow_organizations wo ON wo.id = wu.organization_id
            WHERE wu.auth_id = auth.uid() AND wo.parent_id IS NULL
        )
    );

-- ============================================================
-- workflow_catalog_categories
-- ============================================================
DROP POLICY IF EXISTS "catalog_categories_insert" ON workflow_catalog_categories;
DROP POLICY IF EXISTS "catalog_categories_update" ON workflow_catalog_categories;
DROP POLICY IF EXISTS "catalog_categories_delete" ON workflow_catalog_categories;

CREATE POLICY "catalog_categories_insert"
    ON workflow_catalog_categories FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT wu.organization_id
            FROM workflow_users wu
            JOIN workflow_organizations wo ON wo.id = wu.organization_id
            WHERE wu.auth_id = auth.uid() AND wo.parent_id IS NULL
        )
    );

CREATE POLICY "catalog_categories_update"
    ON workflow_catalog_categories FOR UPDATE
    USING (
        organization_id IN (
            SELECT wu.organization_id
            FROM workflow_users wu
            JOIN workflow_organizations wo ON wo.id = wu.organization_id
            WHERE wu.auth_id = auth.uid() AND wo.parent_id IS NULL
        )
    );

CREATE POLICY "catalog_categories_delete"
    ON workflow_catalog_categories FOR DELETE
    USING (
        organization_id IN (
            SELECT wu.organization_id
            FROM workflow_users wu
            JOIN workflow_organizations wo ON wo.id = wu.organization_id
            WHERE wu.auth_id = auth.uid() AND wo.parent_id IS NULL
        )
    );
