-- ============================================================================
-- Service Catalog — 견적서 · 집행 보고서 카탈로그 통합 테이블
-- Version: 1.0.0
-- Description: 견적서 서비스 카탈로그와 집행 보고서 카탈로그를 DB에서 관리.
--              두 카탈로그를 유기적으로 연결하는 링크 테이블 포함.
-- ============================================================================

-- ============================================================================
-- 1. SERVICE CATALOG (서비스 카탈로그)
-- ============================================================================

CREATE TABLE workflow_service_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES workflow_organizations(id) ON DELETE CASCADE,

    -- 카탈로그 구분: 'estimate' (견적서) | 'execution' (집행 보고서)
    catalog_type TEXT NOT NULL,

    -- 그룹명 (예: '퍼포먼스 광고', '바이럴 마케팅')
    group_name TEXT NOT NULL,

    -- 표시명
    name TEXT NOT NULL,

    -- 정렬 순서
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- 기본 단가(월) — 견적서: base_price, 집행: subtotal
    base_price INTEGER NOT NULL DEFAULT 0,

    -- 타입별 상세 내용 (JSONB)
    -- estimate: { details: [{title, descriptions}], note, options: [{name, price}] }
    -- execution: { icon, fields: [{label, value}] }
    content JSONB NOT NULL DEFAULT '{}',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT workflow_service_catalog_type_check CHECK (
        catalog_type IN ('estimate', 'execution')
    )
);

CREATE INDEX idx_workflow_service_catalog_org
    ON workflow_service_catalog(organization_id);
CREATE INDEX idx_workflow_service_catalog_type
    ON workflow_service_catalog(organization_id, catalog_type);

-- ============================================================================
-- 2. CATALOG LINKS (견적↔집행 카탈로그 연결)
-- ----------------------------------------------------------------------------
-- 견적서 카탈로그 항목과 집행 카탈로그 항목을 N:M으로 연결.
-- 견적서에 서비스를 추가하면, 연결된 집행 항목을 자동 제안할 수 있음.
-- ============================================================================

CREATE TABLE workflow_catalog_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES workflow_organizations(id) ON DELETE CASCADE,
    estimate_catalog_id UUID NOT NULL REFERENCES workflow_service_catalog(id) ON DELETE CASCADE,
    execution_catalog_id UUID NOT NULL REFERENCES workflow_service_catalog(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(estimate_catalog_id, execution_catalog_id)
);

CREATE INDEX idx_workflow_catalog_links_estimate
    ON workflow_catalog_links(estimate_catalog_id);
CREATE INDEX idx_workflow_catalog_links_execution
    ON workflow_catalog_links(execution_catalog_id);

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

ALTER TABLE workflow_service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_catalog_links ENABLE ROW LEVEL SECURITY;

-- Service Catalog: 같은 조직 사용자만 읽기 가능
CREATE POLICY "service_catalog_select" ON workflow_service_catalog
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM workflow_users WHERE auth_id = auth.uid()
        )
    );

-- Service Catalog: admin/manager만 쓰기
CREATE POLICY "service_catalog_insert" ON workflow_service_catalog
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM workflow_users
            WHERE auth_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "service_catalog_update" ON workflow_service_catalog
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM workflow_users
            WHERE auth_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "service_catalog_delete" ON workflow_service_catalog
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id FROM workflow_users
            WHERE auth_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- Catalog Links: same org
CREATE POLICY "catalog_links_select" ON workflow_catalog_links
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM workflow_users WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "catalog_links_insert" ON workflow_catalog_links
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM workflow_users
            WHERE auth_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "catalog_links_delete" ON workflow_catalog_links
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id FROM workflow_users
            WHERE auth_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );
