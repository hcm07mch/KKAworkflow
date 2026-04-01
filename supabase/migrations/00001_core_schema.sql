-- ============================================================================
-- KKA Workflow Core Schema
-- Version: 1.0.0
-- Description: ?濡????쇱댄?ъ댄?愿由???ㅽ? 踰??肄???ㅽㅻ?
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. ORGANIZATIONS (議곗?)
-- ----------------------------------------------------------------------------
-- 紐⑹: ??ㅽ? ?ъ⑺? ???留耳? ???? 愿由?
-- ??: 硫?고?? 吏?? 理?? 而⑦?대
-- ============================================================================
CREATE TABLE workflow_organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,  -- URL-friendly identifier
    settings JSONB DEFAULT '{}',  -- 議곗?蹂 ?ㅼ (而ㅼㅽ ????ъ명?
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_organizations_slug ON workflow_organizations(slug);

-- ============================================================================
-- 3. USERS (?ъ⑹)
-- ----------------------------------------------------------------------------
-- 紐⑹: ??ㅽ ?ъ⑹ (?대뱀, ?뱀몄) 愿由?
-- ??: ?濡????대? 臾몄 ??? ?뱀?沅? 愿由?
-- 李멸?: Supabase Auth? auth.users? ?곕
-- ============================================================================
CREATE TABLE workflow_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE,  -- Supabase Auth user id (auth.users.id)
    organization_id UUID NOT NULL REFERENCES workflow_organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- ?? ??? ???媛?ν?濡 湲곕낯 ??留 ??
    CONSTRAINT workflow_users_role_check CHECK (role IN ('admin', 'manager', 'member'))
);

CREATE INDEX idx_workflow_users_organization ON workflow_users(organization_id);
CREATE INDEX idx_workflow_users_auth_id ON workflow_users(auth_id);
CREATE INDEX idx_workflow_users_email ON workflow_users(email);
CREATE UNIQUE INDEX idx_workflow_users_org_email ON workflow_users(organization_id, email);

-- ============================================================================
-- 4. CLIENTS (怨媛??
-- ----------------------------------------------------------------------------
-- 紐⑹: ?濡??몃? ?猶고? 怨媛??愿由?
-- ??: ?濡??몄 諛二쇱, 臾몄? 理醫 ???
-- 愿怨: 1 Client ? N Projects
-- ============================================================================
CREATE TABLE workflow_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES workflow_organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_name TEXT,  -- ?대뱀 ?대?
    contact_email TEXT,  -- ?대뱀 ?대???
    contact_phone TEXT,  -- ?대뱀 ?곕쎌?
    address TEXT,
    notes TEXT,  -- ?대? 硫紐?
    
    -- 怨媛 ?? 愿由?
    service_type TEXT NOT NULL DEFAULT 'viral',
    payment_type TEXT NOT NULL DEFAULT 'per_invoice',
    tier TEXT NOT NULL DEFAULT 'regular',
    
    metadata JSONB DEFAULT '{}',  -- ????? (而ㅼㅽ ????ъ명?
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- ?鍮???? ???
    CONSTRAINT workflow_clients_service_type_check CHECK (
        service_type IN ('viral', 'performance', 'viral_performance')
    ),
    -- 寃곗 ?? ???
    CONSTRAINT workflow_clients_payment_type_check CHECK (
        payment_type IN ('deposit', 'per_invoice')
    ),
    -- 怨媛 ?깃? ???
    CONSTRAINT workflow_clients_tier_check CHECK (
        tier IN ('regular', 'loyal')
    )
);

CREATE INDEX idx_workflow_clients_organization ON workflow_clients(organization_id);
CREATE INDEX idx_workflow_clients_name ON workflow_clients(organization_id, name);
CREATE INDEX idx_workflow_clients_active ON workflow_clients(organization_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 5. PROJECTS (?濡??? - 以????고?
-- ----------------------------------------------------------------------------
-- 紐⑹: ??ㅽ? 以?? 紐⑤ ?곗댄곌? ?ш린? 洹???
-- ??: ?臾??由? ?⑥. ?? 湲곕??쇰? ?泥??쇱댄?ъ댄?愿由?
-- ?? ?由 (?쇳щ㉫??: draft ? quoted ? contracted ? paid ? running ? completed
-- ?? ?由 (諛?대?:   draft ? quoted ? paid ? running ? completed
-- ============================================================================
CREATE TABLE workflow_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES workflow_organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES workflow_clients(id) ON DELETE RESTRICT,
    
    -- 湲곕낯 ?蹂?
    title TEXT NOT NULL,
    description TEXT,
    code TEXT,  -- ?濡???肄? (?: PRJ-2026-001)
    
    -- ?? 愿由?(?듭?
    status TEXT NOT NULL DEFAULT 'draft',
    
    -- ?鍮???? (怨媛?? ?? 媛?? ?濡??몃? 吏?? 媛??
    service_type TEXT NOT NULL DEFAULT 'viral',
    
    -- ?대뱀
    owner_id UUID REFERENCES workflow_users(id) ON DELETE SET NULL,
    
    -- ?쇱
    start_date DATE,
    end_date DATE,
    
    -- 湲??(而ㅼㅽ ???媛??
    total_amount NUMERIC(15, 2),
    currency TEXT DEFAULT 'KRW',
    
    -- ?????
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- ?? ??? ??⑸ ??媛留 媛??
    CONSTRAINT workflow_projects_status_check CHECK (
        status IN (
            'draft',       -- ??깅? ? ??
            'quoted',      -- 寃ъ ????猷
            'rejected',    -- 怨媛 嫄곗
            'contracted',  -- 怨???猷
            'paid',        -- ?湲 ?猷
            'running',     -- ?? 吏? 以
            'paused',      -- ?쇱 以吏
            'completed',   -- ?? ?猷
            'refunded',    -- ?遺 泥由?
            'cancelled'    -- 痍⑥
        )
    ),
    
    -- ?鍮???? ???
    CONSTRAINT workflow_projects_service_type_check CHECK (
        service_type IN ('viral', 'performance', 'viral_performance')
    )
);

CREATE INDEX idx_workflow_projects_organization ON workflow_projects(organization_id);
CREATE INDEX idx_workflow_projects_client ON workflow_projects(client_id);
CREATE INDEX idx_workflow_projects_status ON workflow_projects(organization_id, status);
CREATE INDEX idx_workflow_projects_service_type ON workflow_projects(organization_id, service_type);
CREATE INDEX idx_workflow_projects_owner ON workflow_projects(owner_id);
CREATE INDEX idx_workflow_projects_code ON workflow_projects(organization_id, code) WHERE code IS NOT NULL;
CREATE INDEX idx_workflow_projects_dates ON workflow_projects(organization_id, start_date, end_date);

-- ============================================================================
-- 6. PROJECT_DOCUMENTS (?濡???臾몄)
-- ----------------------------------------------------------------------------
-- 紐⑹: 紐⑤ 臾몄(寃ъ?/怨?쎌/吏??ъ蹂닿??/蹂닿??)? 怨듯????愿由?
-- ??: 臾몄 異?? ??댁? ??? 愿怨?????쇳 ?뱀?諛??濡吏 ???
-- ?듭? 臾몄? Project? ?? 援ъ깆? (?由???고???)
-- ============================================================================
CREATE TABLE workflow_project_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES workflow_projects(id) ON DELETE CASCADE,
    
    -- 臾몄 ??
    type TEXT NOT NULL,
    
    -- 臾몄 ??
    status TEXT NOT NULL DEFAULT 'draft',
    
    -- 踰? 愿由?
    version INTEGER NOT NULL DEFAULT 1,
    
    -- 臾몄 ?紐?
    title TEXT NOT NULL,
    
    -- 臾몄 ?댁?(??蹂 ?????? ?ш린? JSON?쇰? ???- 而ㅼㅽ ????ъ명?
    content JSONB NOT NULL DEFAULT '{}',
    
    -- 諛???蹂?
    is_sent BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at TIMESTAMPTZ,
    sent_by UUID REFERENCES workflow_users(id) ON DELETE SET NULL,
    sent_to TEXT,  -- 諛???? (?대?????
    
    -- ??깆
    created_by UUID REFERENCES workflow_users(id) ON DELETE SET NULL,
    
    -- 硫??곗댄?
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 臾몄 ?? ???
    CONSTRAINT workflow_documents_type_check CHECK (
        type IN (
            'estimate',    -- 寃ъ?: 怨??寃곗 ?? 紐⑹
            'contract',    -- 怨?쎌: ?쇳щ㉫??留耳? ??
            'pre_report',  -- 吏? ?ъ 蹂닿??: 諛?대??? ?ъ ???
            'report'       -- 蹂닿?? (?ы 蹂닿?)
        )
    ),
    
    -- 臾몄 ?? ???
    CONSTRAINT workflow_documents_status_check CHECK (
        status IN (
            'draft',      -- ???以
            'in_review',  -- 寃? ?泥??
            'approved',   -- ?뱀??猷 (諛??媛??
            'rejected',   -- 諛?ㅻ?
            'sent'        -- 諛???猷
        )
    ),
    
    -- 諛?〓 臾몄? 諛?? approved ?? sent ???ъ???
    CONSTRAINT workflow_documents_sent_status_check CHECK (
        NOT is_sent OR status IN ('approved', 'sent')
    )
);

CREATE INDEX idx_workflow_documents_project ON workflow_project_documents(project_id);
CREATE INDEX idx_workflow_documents_type ON workflow_project_documents(project_id, type);
CREATE INDEX idx_workflow_documents_status ON workflow_project_documents(project_id, status);
CREATE INDEX idx_workflow_documents_created_by ON workflow_project_documents(created_by);
CREATE INDEX idx_workflow_documents_sent ON workflow_project_documents(project_id, is_sent) WHERE is_sent = TRUE;

-- ============================================================================
-- 7. DOCUMENT_APPROVALS (臾몄 ?뱀??대?
-- ----------------------------------------------------------------------------
-- 紐⑹: 臾몄? ?뱀?諛????ы濡??愿由?
-- ??: ?뱀??대?異?. INSERT留 ???(?? 遺媛, audit trail)
-- ?듭? ?뱀몃吏 ?? 臾몄? ?몃? 諛??李⑤?
-- ============================================================================
CREATE TABLE workflow_document_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES workflow_project_documents(id) ON DELETE CASCADE,
    
    -- ?뱀??泥 ?蹂?
    requested_by UUID REFERENCES workflow_users(id) ON DELETE SET NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- ?뱀?諛???蹂?
    approver_id UUID REFERENCES workflow_users(id) ON DELETE SET NULL,
    action TEXT,  -- approve, reject, cancel
    actioned_at TIMESTAMPTZ,
    
    -- ?뱀??④? (?ㅻ④? ?뱀?吏? - 而ㅼㅽ ????ъ명?
    step INTEGER NOT NULL DEFAULT 1,
    
    -- 肄硫??
    comment TEXT,
    
    -- 硫??곗댄?(異媛 ?蹂?
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- ?≪ ???
    CONSTRAINT workflow_approvals_action_check CHECK (
        action IS NULL OR action IN ('approve', 'reject', 'cancel')
    )
);

CREATE INDEX idx_workflow_approvals_document ON workflow_document_approvals(document_id);
CREATE INDEX idx_workflow_approvals_approver ON workflow_document_approvals(approver_id);
CREATE INDEX idx_workflow_approvals_requested ON workflow_document_approvals(requested_by);
CREATE INDEX idx_workflow_approvals_pending ON workflow_document_approvals(document_id, action) WHERE action IS NULL;
CREATE INDEX idx_workflow_approvals_action ON workflow_document_approvals(document_id, action, actioned_at);

-- ============================================================================
-- 8. ACTIVITY_LOGS (?? ?대?
-- ----------------------------------------------------------------------------
-- 紐⑹: ??ㅽ ??紐⑤ 二쇱 ?? 湲곕?
-- ??: 媛??異?, ?대?議고, 臾몄 ???遺?
-- ?뱀?: Polymorphic 李몄“ (entity_type + entity_id)
-- ============================================================================
CREATE TABLE workflow_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES workflow_organizations(id) ON DELETE CASCADE,
    
    -- ?? ??고?(Polymorphic)
    entity_type TEXT NOT NULL,  -- project, document, client, approval ??
    entity_id UUID NOT NULL,
    
    -- 異媛 而⑦?ㅽ?(???)
    project_id UUID REFERENCES workflow_projects(id) ON DELETE SET NULL,
    
    -- ?? ?蹂?
    action TEXT NOT NULL,  -- created, updated, status_changed, approved, sent ??
    actor_id UUID REFERENCES workflow_users(id) ON DELETE SET NULL,
    
    -- ????蹂?
    description TEXT,
    
    -- 蹂寃??? ?곗댄?(???)
    old_data JSONB,
    new_data JSONB,
    
    -- 硫??곗댄?(IP, User Agent ??
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partitioning 怨?? ?? 濡洹?? ?蹂 ??곗 沅??
CREATE INDEX idx_workflow_logs_organization ON workflow_activity_logs(organization_id);
CREATE INDEX idx_workflow_logs_entity ON workflow_activity_logs(entity_type, entity_id);
CREATE INDEX idx_workflow_logs_project ON workflow_activity_logs(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_workflow_logs_actor ON workflow_activity_logs(actor_id);
CREATE INDEX idx_workflow_logs_action ON workflow_activity_logs(organization_id, action);
CREATE INDEX idx_workflow_logs_created ON workflow_activity_logs(organization_id, created_at DESC);

-- ============================================================================
-- 9. HELPER FUNCTIONS
-- ============================================================================

-- updated_at ?? 媛깆 ?몃━嫄??⑥
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 媛 ??대?? ?몃━嫄????
CREATE TRIGGER trg_workflow_organizations_updated_at
    BEFORE UPDATE ON workflow_organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_workflow_users_updated_at
    BEFORE UPDATE ON workflow_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_workflow_clients_updated_at
    BEFORE UPDATE ON workflow_clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_workflow_projects_updated_at
    BEFORE UPDATE ON workflow_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_workflow_documents_updated_at
    BEFORE UPDATE ON workflow_project_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 10. PROJECT STATUS TRANSITION VALIDATION
-- ----------------------------------------------------------------------------
-- ?? ???洹移? 媛??? ?몃━嫄?
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_project_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    valid_transitions JSONB;
BEGIN
    -- ??媛 蹂寃쎈吏 ???쇰㈃ ?듦낵
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- ??⑸ ?? ?????
    -- 李멸?: quoted ? paid ? 諛?대?留耳? (怨?쎌 遺??) 寃쎈?
    valid_transitions := '{
        "draft": ["quoted", "cancelled"],
        "quoted": ["contracted", "paid", "rejected", "cancelled"],
        "rejected": ["draft", "cancelled"],
        "contracted": ["paid", "cancelled"],
        "paid": ["running", "refunded", "cancelled"],
        "running": ["paused", "completed", "cancelled"],
        "paused": ["running", "cancelled"],
        "completed": [],
        "refunded": [],
        "cancelled": []
    }'::JSONB;
    
    -- ???寃利
    IF NOT (valid_transitions->OLD.status) ? NEW.status THEN
        RAISE EXCEPTION 'Invalid status transition: % -> %', OLD.status, NEW.status;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workflow_projects_status_transition
    BEFORE UPDATE OF status ON workflow_projects
    FOR EACH ROW EXECUTE FUNCTION validate_project_status_transition();

-- ============================================================================
-- 11. DOCUMENT SEND VALIDATION
-- ----------------------------------------------------------------------------
-- ?뱀몃吏 ?? 臾몄 諛??李⑤?
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_document_send()
RETURNS TRIGGER AS $$
BEGIN
    -- is_sent媛 TRUE濡 蹂寃쎈 ?留 寃利
    IF NEW.is_sent = TRUE AND (OLD.is_sent = FALSE OR OLD.is_sent IS NULL) THEN
        -- approved ???몄? ???
        IF NEW.status NOT IN ('approved', 'sent') THEN
            RAISE EXCEPTION '?뱀몃吏 ?? 臾몄? 諛?≫ ? ??듬?? ?????: %', NEW.status;
        END IF;
        
        -- 諛???蹂??? ?ㅼ
        IF NEW.sent_at IS NULL THEN
            NEW.sent_at = NOW();
        END IF;
        
        -- ??瑜?sent濡 蹂寃?
        NEW.status = 'sent';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workflow_documents_send_validation
    BEFORE UPDATE OF is_sent ON workflow_project_documents
    FOR EACH ROW EXECUTE FUNCTION validate_document_send();

-- ============================================================================
-- 12. COMMENTS (Optional - ?ν ???
-- ============================================================================

COMMENT ON TABLE workflow_organizations IS '??ㅽ? ?ъ⑺? ???留耳? ???? - 硫?고?? 吏?';
COMMENT ON TABLE workflow_users IS '??ㅽ ?ъ⑹ - Supabase Auth? ?곕';
COMMENT ON TABLE workflow_clients IS '?濡??몃? ?猶고? 怨媛??;
COMMENT ON TABLE workflow_projects IS '以????고?- 紐⑤ ?곗댄곌? ?ш린? 洹???;
COMMENT ON TABLE workflow_project_documents IS '?濡??몄 洹??? 臾몄 (寃ъ?/怨?쎌/吏??ъ蹂닿??/蹂닿??)';
COMMENT ON TABLE workflow_document_approvals IS '臾몄 ?뱀?諛???대?- INSERT only, 媛??異???;
COMMENT ON TABLE workflow_activity_logs IS '紐⑤ 二쇱 ?? 湲곕? - Polymorphic 李몄“';

COMMENT ON COLUMN workflow_projects.status IS '?濡?????: draft?quoted?contracted?paid?running?completed';
COMMENT ON COLUMN workflow_project_documents.status IS '臾몄 ??: draft?in_review?approved?sent';
COMMENT ON COLUMN workflow_project_documents.content IS '臾몄 ??蹂 ????? (而ㅼㅽ ????ъ명?';
COMMENT ON COLUMN workflow_document_approvals.step IS '?ㅻ④? ?뱀?? ?뱀??④? 踰??;
