-- Migration: 00024_share_hq_catalog_with_branches
-- Purpose:
--   카탈로그(서비스 카탈로그 / 카테고리 / 링크)를 본사와 지사가 "공유"하도록 변경.
--   기존에는 지사가 sync-from-hq 로 본사 카탈로그를 자기 조직으로 복사했지만,
--   이제 지사 사용자는 본사 카탈로그를 직접 읽어 쓴다.
--
--   정책 요약
--   - 모든 지사가 소유하던 카탈로그/카테고리/링크 행을 삭제 (본사에만 남김).
--   - SELECT: 본사(root) 데이터만 존재하므로 "사용자의 root org = row.organization_id" 조건으로 허용.
--   - INSERT/UPDATE/DELETE: 본사 소속 계정만 허용 (기존 정책 유지 방향과 동일).
--
--   주의
--   - 이 마이그레이션 적용 전에 지사 카탈로그 커스터마이즈가 있었다면 해당 데이터는 사라진다.
--   - 문서 본문(JSONB)에 남아있는 이름/가격 등은 그대로 유지되며, 카탈로그 ID 참조는 없으므로 안전.

-- ============================================================
-- 0) 비(非)본사 조직에 저장된 카탈로그 관련 데이터 제거
--    workflow_organizations.parent_id IS NOT NULL 인 조직 = 지사
-- ============================================================
DELETE FROM workflow_catalog_links cl
USING workflow_organizations o
WHERE cl.organization_id = o.id
  AND o.parent_id IS NOT NULL;

DELETE FROM workflow_service_catalog sc
USING workflow_organizations o
WHERE sc.organization_id = o.id
  AND o.parent_id IS NOT NULL;

DELETE FROM workflow_catalog_categories cc
USING workflow_organizations o
WHERE cc.organization_id = o.id
  AND o.parent_id IS NOT NULL;

-- ============================================================
-- 1) workflow_service_catalog
-- ============================================================
DROP POLICY IF EXISTS "service_catalog_select" ON workflow_service_catalog;

-- 본사(root) 소속은 자기 조직 row, 지사 소속은 부모(본사) 조직 row 를 읽는다.
CREATE POLICY "service_catalog_select" ON workflow_service_catalog
    FOR SELECT USING (
        organization_id IN (
            -- 본사 계정: 자기 조직 그대로
            SELECT wu.organization_id
            FROM workflow_users wu
            JOIN workflow_organizations wo ON wo.id = wu.organization_id
            WHERE wu.auth_id = auth.uid() AND wo.parent_id IS NULL
            UNION
            -- 지사 계정: 부모(본사) 조직
            SELECT wo.parent_id
            FROM workflow_users wu
            JOIN workflow_organizations wo ON wo.id = wu.organization_id
            WHERE wu.auth_id = auth.uid() AND wo.parent_id IS NOT NULL
        )
    );

-- INSERT/UPDATE/DELETE 는 기존 00022 정책 유지 (본사 계정만).

-- ============================================================
-- 2) workflow_catalog_links
-- ============================================================
DROP POLICY IF EXISTS "catalog_links_select" ON workflow_catalog_links;

CREATE POLICY "catalog_links_select" ON workflow_catalog_links
    FOR SELECT USING (
        organization_id IN (
            SELECT wu.organization_id
            FROM workflow_users wu
            JOIN workflow_organizations wo ON wo.id = wu.organization_id
            WHERE wu.auth_id = auth.uid() AND wo.parent_id IS NULL
            UNION
            SELECT wo.parent_id
            FROM workflow_users wu
            JOIN workflow_organizations wo ON wo.id = wu.organization_id
            WHERE wu.auth_id = auth.uid() AND wo.parent_id IS NOT NULL
        )
    );

-- ============================================================
-- 3) workflow_catalog_categories
-- ============================================================
DROP POLICY IF EXISTS "catalog_categories_select" ON workflow_catalog_categories;

CREATE POLICY "catalog_categories_select"
    ON workflow_catalog_categories FOR SELECT
    USING (
        organization_id IN (
            SELECT wu.organization_id
            FROM workflow_users wu
            JOIN workflow_organizations wo ON wo.id = wu.organization_id
            WHERE wu.auth_id = auth.uid() AND wo.parent_id IS NULL
            UNION
            SELECT wo.parent_id
            FROM workflow_users wu
            JOIN workflow_organizations wo ON wo.id = wu.organization_id
            WHERE wu.auth_id = auth.uid() AND wo.parent_id IS NOT NULL
        )
    );
