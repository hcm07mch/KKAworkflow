-- ============================================================================
-- KKA Workflow Migration: Service Type, Payment Type, Client Tier
-- Version: 1.0.0
-- Description: 怨媛 ?鍮???? / 寃곗 諛⑹ / 怨媛 ?깃? 異媛, 臾몄 ?? campaign ? pre_report 蹂寃?
-- 
-- 蹂寃??ы:
--   1. workflow_clients: service_type, payment_type, tier 而щ?異媛
--   2. workflow_projects: service_type 而щ?異媛
--   3. 臾몄 ?? campaign ? pre_report (CHECK constraint + 湲곗〈 ?곗댄?
--   4. ?濡????? ??? quoted ? paid 寃쎈? 異媛 (諛?대?留耳?)
--   5. ??媛 酉?媛깆
-- ============================================================================

-- ============================================================================
-- 1. workflow_clients: 怨媛 ?? 而щ?異媛
-- ============================================================================

ALTER TABLE workflow_clients
    ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'viral',
    ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'per_invoice',
    ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'regular';

-- CHECK constraints
ALTER TABLE workflow_clients
    ADD CONSTRAINT workflow_clients_service_type_check CHECK (
        service_type IN ('viral', 'performance', 'viral_performance')
    );

ALTER TABLE workflow_clients
    ADD CONSTRAINT workflow_clients_payment_type_check CHECK (
        payment_type IN ('deposit', 'per_invoice')
    );

ALTER TABLE workflow_clients
    ADD CONSTRAINT workflow_clients_tier_check CHECK (
        tier IN ('regular', 'loyal')
    );

-- ============================================================================
-- 2. workflow_projects: service_type 而щ?異媛
-- ============================================================================

ALTER TABLE workflow_projects
    ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'viral';

ALTER TABLE workflow_projects
    ADD CONSTRAINT workflow_projects_service_type_check CHECK (
        service_type IN ('viral', 'performance', 'viral_performance')
    );

CREATE INDEX IF NOT EXISTS idx_workflow_projects_service_type
    ON workflow_projects(organization_id, service_type);

-- ============================================================================
-- 3. 臾몄 ??: campaign ? pre_report
-- ----------------------------------------------------------------------------
-- ??: 湲곗〈 ?곗댄???곗댄?? CHECK 援泥?
-- ============================================================================

-- 3-1. 湲곗〈 ?곗댄?留?닿렇??댁
UPDATE workflow_project_documents
SET type = 'pre_report'
WHERE type = 'campaign';

-- 3-2. workflow_project_documents: CHECK 援泥?
ALTER TABLE workflow_project_documents
    DROP CONSTRAINT IF EXISTS workflow_documents_type_check;

ALTER TABLE workflow_project_documents
    ADD CONSTRAINT workflow_documents_type_check CHECK (
        type IN ('estimate', 'contract', 'pre_report', 'report')
    );

-- 3-3. workflow_approval_policies: CHECK 援泥?
ALTER TABLE workflow_approval_policies
    DROP CONSTRAINT IF EXISTS workflow_ap_document_type_check;

ALTER TABLE workflow_approval_policies
    ADD CONSTRAINT workflow_ap_document_type_check CHECK (
        document_type IS NULL OR document_type IN ('estimate', 'contract', 'pre_report', 'report')
    );

-- 3-4. ?뱀??梨 湲곗〈 ?곗댄?留?닿렇??댁
UPDATE workflow_approval_policies
SET document_type = 'pre_report'
WHERE document_type = 'campaign';

-- ============================================================================
-- 4. ?濡????? ??? quoted ? paid 異媛 (諛?대?留耳? 寃쎈?)
-- ----------------------------------------------------------------------------
-- 湲곗〈: quoted ? [contracted, rejected, cancelled]
-- 蹂寃? quoted ? [contracted, paid, rejected, cancelled]
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_project_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    valid_transitions JSONB;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- quoted ? paid: 諛?대?留耳? (怨?쎌 遺??) 寃쎈?
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

    IF NOT (valid_transitions->OLD.status) ? NEW.status THEN
        RAISE EXCEPTION 'Invalid status transition: % -> %', OLD.status, NEW.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. ??媛 酉?媛깆: campaign ? pre_report
-- ============================================================================

CREATE OR REPLACE VIEW workflow_v_document_types AS
SELECT * FROM (VALUES
    ('estimate',   1, '寃ъ?',             '?濡???寃ъ 臾몄'),
    ('contract',   2, '怨?쎌',             '怨??愿??臾몄'),
    ('pre_report', 3, '吏? ?ъ 蹂닿??',   '諛?대??? ?ъ ???臾몄'),
    ('report',     4, '蹂닿??',             '寃곌낵 蹂닿??')
) AS t(type, sort_order, label_ko, description);

-- ============================================================================
-- 6. 肄硫??
-- ============================================================================

COMMENT ON COLUMN workflow_clients.service_type IS '?鍮????: viral | performance | viral_performance';
COMMENT ON COLUMN workflow_clients.payment_type IS '寃곗 諛⑹: deposit (?移湲) | per_invoice (嫄대?)';
COMMENT ON COLUMN workflow_clients.tier IS '怨媛 ?깃?: regular (?쇰?) | loyal (異⑹?';
COMMENT ON COLUMN workflow_projects.service_type IS '?鍮????: viral | performance | viral_performance (怨媛?? ?? ?? 媛蹂 吏?)';
