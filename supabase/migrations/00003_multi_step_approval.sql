-- ============================================================================
-- KKA Workflow Migration: Multi-Step Approval
-- Version: 1.0.1
-- Description: ?ㅻ④? ?뱀?硫而ㅻ利 Core 吏?
-- ============================================================================

-- ============================================================================
-- 1. APPROVAL_POLICIES (?뱀??梨)
-- ----------------------------------------------------------------------------
-- 紐⑹: 議곗?蹂쨌臾몄??蹂 ?? ?뱀??④? ? 愿由?
-- ??: 臾몄 諛??? 紐 ?④?? ?뱀몄 嫄곗?????吏 ??
-- ?듭? 紐⑤ ?④?媛 ?뱀??猷??댁?臾몄媛 approved濡 ???
-- ============================================================================
CREATE TABLE workflow_approval_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES workflow_organizations(id) ON DELETE CASCADE,
    
    -- ?? 臾몄 ?? (null = 紐⑤ ??? 湲곕낯 ?梨)
    document_type TEXT,
    
    -- ?뱀??④? ? (湲곕낯: 1)
    required_steps INTEGER NOT NULL DEFAULT 1,
    
    -- ?ㅻ? (愿由ъ?
    description TEXT,
    
    -- ????щ?
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 臾몄 ?? ???(null ???= ?泥?湲곕낯媛)
    CONSTRAINT workflow_ap_document_type_check CHECK (
        document_type IS NULL OR document_type IN ('estimate', 'contract', 'pre_report', 'report')
    ),
    
    -- ?④? ? ???(1~10)
    CONSTRAINT workflow_ap_steps_check CHECK (required_steps BETWEEN 1 AND 10),
    
    -- 議곗? + 臾몄?? ????(? 議곗??? ??????? ?梨)
    CONSTRAINT workflow_ap_org_type_unique UNIQUE (organization_id, document_type)
);

CREATE INDEX idx_workflow_ap_organization ON workflow_approval_policies(organization_id);
CREATE INDEX idx_workflow_ap_active ON workflow_approval_policies(organization_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 2. APPROVAL_POLICY_STEPS (?뱀??④?蹂 ?ㅼ)
-- ----------------------------------------------------------------------------
-- 紐⑹: 媛 ?④?蹂 ?뱀?媛????(怨痢? ??
-- ??: "1?④?? manager, 2?④?? admin"怨?媛? ?④?蹂 ?ㅼ
-- ============================================================================
CREATE TABLE workflow_approval_policy_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID NOT NULL REFERENCES workflow_approval_policies(id) ON DELETE CASCADE,
    
    -- ?④? 踰??(1遺????)
    step INTEGER NOT NULL,
    
    -- ???④?瑜??뱀명 ? ?? 理? ??
    required_role TEXT NOT NULL DEFAULT 'manager',
    
    -- ?④? ?대? (UI ???? ?: '????뱀?, '?? ?뱀?)
    label TEXT,
    
    -- ?뱀 ?ъ⑹ 吏? (null = ?? 湲곕?)
    assigned_user_id UUID REFERENCES workflow_users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- ?? ???
    CONSTRAINT workflow_aps_role_check CHECK (required_role IN ('admin', 'manager', 'member')),
    
    -- ?④? 踰? ???
    CONSTRAINT workflow_aps_step_check CHECK (step BETWEEN 1 AND 10),
    
    -- ?梨 + ?④? ????
    CONSTRAINT workflow_aps_policy_step_unique UNIQUE (policy_id, step)
);

CREATE INDEX idx_workflow_aps_policy ON workflow_approval_policy_steps(policy_id);

-- ============================================================================
-- 3. 湲곕낯 ?梨 ?쎌 ?ы?
-- ----------------------------------------------------------------------------
-- ?ъ⑸?: SELECT create_default_approval_policy('org-uuid');
-- ============================================================================
CREATE OR REPLACE FUNCTION create_default_approval_policy(org_id UUID)
RETURNS VOID AS $$
DECLARE
  policy_id UUID;
BEGIN
  -- 議곗? ?泥?湲곕낯 ?梨 (1?④?, manager ?뱀?
  INSERT INTO workflow_approval_policies (organization_id, document_type, required_steps, description)
  VALUES (org_id, NULL, 1, '湲곕낯 ?뱀??梨')
  ON CONFLICT (organization_id, document_type) DO NOTHING
  RETURNING id INTO policy_id;
  
  IF policy_id IS NOT NULL THEN
    INSERT INTO workflow_approval_policy_steps (policy_id, step, required_role, label)
    VALUES (policy_id, 1, 'manager', '留ㅻ? ?뱀?);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. updated_at ?몃━嫄??곌껐
-- ============================================================================
CREATE TRIGGER set_workflow_approval_policies_updated_at
    BEFORE UPDATE ON workflow_approval_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 5. RLS ?梨
-- ============================================================================
ALTER TABLE workflow_approval_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_approval_policy_steps ENABLE ROW LEVEL SECURITY;

-- approval_policies: 媛? 議곗?留 ?洹?
CREATE POLICY "approval_policies_select" ON workflow_approval_policies
    FOR SELECT USING (organization_id = get_current_user_organization_id());

CREATE POLICY "approval_policies_insert" ON workflow_approval_policies
    FOR INSERT WITH CHECK (
        organization_id = get_current_user_organization_id()
        AND get_current_user_role() = 'admin'
    );

CREATE POLICY "approval_policies_update" ON workflow_approval_policies
    FOR UPDATE USING (
        organization_id = get_current_user_organization_id()
        AND get_current_user_role() = 'admin'
    );

-- approval_policy_steps: ?梨 ?? 議곗?留 ?洹?
CREATE POLICY "approval_policy_steps_select" ON workflow_approval_policy_steps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workflow_approval_policies ap
            WHERE ap.id = workflow_approval_policy_steps.policy_id
            AND ap.organization_id = get_current_user_organization_id()
        )
    );

CREATE POLICY "approval_policy_steps_insert" ON workflow_approval_policy_steps
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM workflow_approval_policies ap
            WHERE ap.id = workflow_approval_policy_steps.policy_id
            AND ap.organization_id = get_current_user_organization_id()
        )
        AND get_current_user_role() = 'admin'
    );

CREATE POLICY "approval_policy_steps_update" ON workflow_approval_policy_steps
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM workflow_approval_policies ap
            WHERE ap.id = workflow_approval_policy_steps.policy_id
            AND ap.organization_id = get_current_user_organization_id()
        )
        AND get_current_user_role() = 'admin'
    );
