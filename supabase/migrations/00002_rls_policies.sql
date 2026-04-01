-- ============================================================================
-- KKA Workflow RLS Policies
-- Version: 1.0.0
-- Description: Row Level Security ?梨 諛 ??媛 ?ㅺ? ?由?
-- ============================================================================

-- ============================================================================
-- PART 1: ??媛 ?ㅺ? ?由?
-- ============================================================================
-- 
-- ???????????????????????????????????????????????????????????????????????????
-- ? ?ㅺ? ?移                                                               ?
-- ????????????????????????????????????????????????????????????????????????????
-- ? 1. TEXT + CHECK constraint ?ъ?(ENUM ?쇳?                            ?
-- ? 2. 留?닿렇??댁 鍮??理??                                             ?
-- ? 3. ?? ??? ? 怨녹? 愿由?(?????+ Types)                         ?
-- ? 4. ?ν ???? CHECK constraint留 ??                                 ?
-- ???????????????????????????????????????????????????????????????????????????
--
-- ???????????????????????????????????????????????????????????????????????????
-- ? ??媛 ???                                                            ?
-- ????????????????????????????????????????????????????????????????????????????
-- ? workflow_projects.status              : ?濡????쇱댄?ъ댄?           ?
-- ? workflow_project_documents.status     : 臾몄 ?뱀???                   ?
-- ? workflow_project_documents.type       : 臾몄 醫瑜                        ?
-- ? workflow_document_approvals.action    : ?뱀??≪                        ?
-- ? workflow_users.role                   : ?ъ⑹ ??                      ?
-- ???????????????????????????????????????????????????????????????????????????
--
-- ?ν ?????由ъ?
-- - ??щ? 異媛 ??媛 ???硫?workflow_organizations.settings? 而ㅼㅽ ?? ??
-- - ?? ??대? 遺由ш? ???댁?硫?洹몃 留?닿렇??댁 (??щ 怨쇰? ?洹?)


-- ============================================================================
-- PART 2: RLS ??깊
-- ============================================================================

ALTER TABLE workflow_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_document_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_activity_logs ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- PART 3: HELPER FUNCTIONS
-- ============================================================================

-- ????ъ⑹? organization_id 媛?몄ㅺ린
CREATE OR REPLACE FUNCTION get_current_user_organization_id()
RETURNS UUID AS $$
DECLARE
    org_id UUID;
BEGIN
    SELECT organization_id INTO org_id
    FROM workflow_users
    WHERE auth_id = auth.uid();
    
    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ????ъ⑹? role 媛?몄ㅺ린
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM workflow_users
    WHERE auth_id = auth.uid();
    
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ????ъ⑹? user_id 媛?몄ㅺ린
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
DECLARE
    user_id UUID;
BEGIN
    SELECT id INTO user_id
    FROM workflow_users
    WHERE auth_id = auth.uid();
    
    RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ?ъ⑹媛 ?뱀 議곗?? ???吏 ???
CREATE OR REPLACE FUNCTION is_member_of_organization(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM workflow_users
        WHERE auth_id = auth.uid()
        AND organization_id = org_id
        AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================================
-- PART 4: ORGANIZATIONS ?梨
-- ============================================================================

-- 議곗? 議고: ?????? 議곗?留
CREATE POLICY "organizations_select_own"
    ON workflow_organizations FOR SELECT
    USING (is_member_of_organization(id));

-- 議곗? ??: admin留
CREATE POLICY "organizations_update_admin"
    ON workflow_organizations FOR UPDATE
    USING (
        is_member_of_organization(id)
        AND get_current_user_role() = 'admin'
    );

-- 議곗? ??? ?몄?? ?ъ⑹ (??媛? ?)
-- 李멸?: ?ㅼ濡? ?踰 ?ъ대?? 泥由?沅??
CREATE POLICY "organizations_insert_authenticated"
    ON workflow_organizations FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================================================
-- PART 5: USERS ?梨
-- ============================================================================

-- ?ъ⑹ 議고: 媛? 議곗??留
CREATE POLICY "users_select_same_org"
    ON workflow_users FOR SELECT
    USING (organization_id = get_current_user_organization_id());

-- ?ъ⑹ ??? admin留
CREATE POLICY "users_insert_admin"
    ON workflow_users FOR INSERT
    WITH CHECK (
        organization_id = get_current_user_organization_id()
        AND get_current_user_role() = 'admin'
    );

-- ?ъ⑹ ??: 蹂몄??? admin
CREATE POLICY "users_update_self_or_admin"
    ON workflow_users FOR UPDATE
    USING (
        organization_id = get_current_user_organization_id()
        AND (
            auth_id = auth.uid()
            OR get_current_user_role() = 'admin'
        )
    );

-- ?ъ⑹ ??: admin留
CREATE POLICY "users_delete_admin"
    ON workflow_users FOR DELETE
    USING (
        organization_id = get_current_user_organization_id()
        AND get_current_user_role() = 'admin'
    );


-- ============================================================================
-- PART 6: CLIENTS ?梨
-- ============================================================================

-- 怨媛??議고: 媛? 議곗?留
CREATE POLICY "clients_select_same_org"
    ON workflow_clients FOR SELECT
    USING (organization_id = get_current_user_organization_id());

-- 怨媛????? 媛? 議곗? (member ?댁)
CREATE POLICY "clients_insert_same_org"
    ON workflow_clients FOR INSERT
    WITH CHECK (organization_id = get_current_user_organization_id());

-- 怨媛????: 媛? 議곗? (member ?댁)
CREATE POLICY "clients_update_same_org"
    ON workflow_clients FOR UPDATE
    USING (organization_id = get_current_user_organization_id());

-- 怨媛????: admin/manager留
CREATE POLICY "clients_delete_manager"
    ON workflow_clients FOR DELETE
    USING (
        organization_id = get_current_user_organization_id()
        AND get_current_user_role() IN ('admin', 'manager')
    );


-- ============================================================================
-- PART 7: PROJECTS ?梨
-- ============================================================================

-- ?濡???議고: 媛? 議곗?留
CREATE POLICY "projects_select_same_org"
    ON workflow_projects FOR SELECT
    USING (organization_id = get_current_user_organization_id());

-- ?濡?????? 媛? 議곗? (member ?댁)
CREATE POLICY "projects_insert_same_org"
    ON workflow_projects FOR INSERT
    WITH CHECK (organization_id = get_current_user_organization_id());

-- ?濡?????: ?대뱀 ?? manager/admin
CREATE POLICY "projects_update_owner_or_manager"
    ON workflow_projects FOR UPDATE
    USING (
        organization_id = get_current_user_organization_id()
        AND (
            owner_id = get_current_user_id()
            OR get_current_user_role() IN ('admin', 'manager')
        )
    );

-- ?濡?????: admin留 (draft ??留)
CREATE POLICY "projects_delete_admin_draft"
    ON workflow_projects FOR DELETE
    USING (
        organization_id = get_current_user_organization_id()
        AND get_current_user_role() = 'admin'
        AND status = 'draft'
    );


-- ============================================================================
-- PART 8: PROJECT_DOCUMENTS ?梨
-- ============================================================================

-- 臾몄 議고: ?濡???議고 沅? ??쇰㈃ 媛??
CREATE POLICY "documents_select_via_project"
    ON workflow_project_documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workflow_projects
            WHERE workflow_projects.id = workflow_project_documents.project_id
            AND workflow_projects.organization_id = get_current_user_organization_id()
        )
    );

-- 臾몄 ??? ?濡???議고 沅? ??쇰㈃ 媛??
CREATE POLICY "documents_insert_via_project"
    ON workflow_project_documents FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workflow_projects
            WHERE workflow_projects.id = workflow_project_documents.project_id
            AND workflow_projects.organization_id = get_current_user_organization_id()
        )
    );

-- 臾몄 ??: ??깆 ?? manager/admin
-- ?? sent ?? 臾몄? ?? 遺媛
CREATE POLICY "documents_update_owner_or_manager"
    ON workflow_project_documents FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workflow_projects
            WHERE workflow_projects.id = workflow_project_documents.project_id
            AND workflow_projects.organization_id = get_current_user_organization_id()
        )
        AND status != 'sent'
        AND (
            created_by = get_current_user_id()
            OR get_current_user_role() IN ('admin', 'manager')
        )
    );

-- 臾몄 ??: admin留, draft ??留
CREATE POLICY "documents_delete_admin_draft"
    ON workflow_project_documents FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM workflow_projects
            WHERE workflow_projects.id = workflow_project_documents.project_id
            AND workflow_projects.organization_id = get_current_user_organization_id()
        )
        AND get_current_user_role() = 'admin'
        AND status = 'draft'
    );


-- ============================================================================
-- PART 9: DOCUMENT_APPROVALS ?梨
-- ============================================================================

-- ?뱀??대?議고: 臾몄 議고 沅? ??쇰㈃ 媛??
CREATE POLICY "approvals_select_via_document"
    ON workflow_document_approvals FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workflow_project_documents pd
            JOIN workflow_projects p ON p.id = pd.project_id
            WHERE pd.id = workflow_document_approvals.document_id
            AND p.organization_id = get_current_user_organization_id()
        )
    );

-- ?뱀??泥 ??? 臾몄 ???沅? ??쇰㈃ 媛??
CREATE POLICY "approvals_insert_via_document"
    ON workflow_document_approvals FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workflow_project_documents pd
            JOIN workflow_projects p ON p.id = pd.project_id
            WHERE pd.id = workflow_document_approvals.document_id
            AND p.organization_id = get_current_user_organization_id()
        )
    );

-- ?뱀?泥由?UPDATE): manager/admin留
-- 李멸?: ?뱀??대μ INSERT only媛 ?移?대, action 湲곕?? ???UPDATE ???
CREATE POLICY "approvals_update_manager"
    ON workflow_document_approvals FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workflow_project_documents pd
            JOIN workflow_projects p ON p.id = pd.project_id
            WHERE pd.id = workflow_document_approvals.document_id
            AND p.organization_id = get_current_user_organization_id()
        )
        AND get_current_user_role() IN ('admin', 'manager')
    );


-- ============================================================================
-- PART 10: ACTIVITY_LOGS ?梨
-- ============================================================================

-- ?대?議고: 媛? 議곗?留
CREATE POLICY "logs_select_same_org"
    ON workflow_activity_logs FOR SELECT
    USING (organization_id = get_current_user_organization_id());

-- ?대???? 媛? 議곗? (??ㅽ?? ?? ???
CREATE POLICY "logs_insert_same_org"
    ON workflow_activity_logs FOR INSERT
    WITH CHECK (organization_id = get_current_user_organization_id());

-- ?대???/??: 遺媛 (媛??異? 蹂댁〈)
-- UPDATE, DELETE ?梨 ?? ? 湲곕낯??쇰? 嫄곕???


-- ============================================================================
-- PART 11: ?? ???沅? 寃利 ?⑥
-- ============================================================================

-- ?濡????? ???沅? 寃利
-- ?뱀 ?? ??대 ?뱀 ??留 媛?ν?濡 ?ㅼ
CREATE OR REPLACE FUNCTION check_project_status_transition_permission(
    p_project_id UUID,
    p_new_status TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    current_status TEXT;
    user_role TEXT;
BEGIN
    SELECT status INTO current_status FROM workflow_projects WHERE id = p_project_id;
    user_role := get_current_user_role();
    
    -- ?遺(refunded), 痍⑥(cancelled): admin留
    IF p_new_status IN ('refunded', 'cancelled') THEN
        RETURN user_role = 'admin';
    END IF;
    
    -- 怨??contracted), ?湲???paid): manager ?댁
    IF p_new_status IN ('contracted', 'paid') THEN
        RETURN user_role IN ('admin', 'manager');
    END IF;
    
    -- 洹??? member ?댁 媛??
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================================
-- PART 12: 臾몄 諛??沅? 寃利 ?⑥
-- ============================================================================

-- 臾몄 諛??? 理醫 寃利
CREATE OR REPLACE FUNCTION validate_document_can_send(p_document_id UUID)
RETURNS TABLE (
    can_send BOOLEAN,
    reason TEXT
) AS $$
DECLARE
    doc_status TEXT;
    doc_type TEXT;
    has_approval BOOLEAN;
BEGIN
    SELECT status, type INTO doc_status, doc_type
    FROM workflow_project_documents WHERE id = p_document_id;
    
    -- ?? 寃利
    IF doc_status IS NULL THEN
        RETURN QUERY SELECT FALSE, '臾몄瑜?李얠 ? ??듬??';
        RETURN;
    END IF;
    
    IF doc_status NOT IN ('approved') THEN
        RETURN QUERY SELECT FALSE, '?뱀몃吏 ?? 臾몄? 諛?≫ ? ??듬?? ?????: ' || doc_status;
        RETURN;
    END IF;
    
    -- ?뱀??대?寃利
    SELECT EXISTS (
        SELECT 1 FROM workflow_document_approvals
        WHERE document_id = p_document_id
        AND action = 'approve'
    ) INTO has_approval;
    
    IF NOT has_approval THEN
        RETURN QUERY SELECT FALSE, '?뱀??대μ???듬??';
        RETURN;
    END IF;
    
    RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================================
-- PART 13: ??媛 ?? 酉?(Optional - ?濡?몄? 李몄“??
-- ============================================================================

-- ?濡????? 議고??酉?
CREATE OR REPLACE VIEW workflow_v_project_statuses AS
SELECT * FROM (VALUES
    ('draft',      1,  '珥?',        '???以???濡???),
    ('quoted',     2,  '寃ъ?猷',    '寃ъ? ????猷'),
    ('rejected',   3,  '嫄곗',        '怨媛??嫄곗??),
    ('contracted', 4,  '怨?쎌猷',    '怨??泥닿껐??),
    ('paid',       5,  '?湲?猷',    '?湲 ??몃?),
    ('running',    6,  '吏?以',      '?? 吏? 以'),
    ('paused',     7,  '?쇱以吏',    '?? ?쇱 以吏'),
    ('completed',  8,  '?猷',        '紐⑤ ?? ?猷'),
    ('refunded',   9,  '?遺',        '?遺 泥由щ?),
    ('cancelled', 10,  '痍⑥',        '?濡???痍⑥')
) AS t(status, sort_order, label_ko, description);

-- 臾몄 ?? 議고??酉?
CREATE OR REPLACE VIEW workflow_v_document_statuses AS
SELECT * FROM (VALUES
    ('draft',     1, '??깆?',   '???以??臾몄'),
    ('in_review', 2, '寃?以',   '?뱀?寃? ?泥??),
    ('approved',  3, '?뱀몃?,   '?뱀??猷, 諛??媛??),
    ('rejected',  4, '諛?ㅻ?,   '?뱀?諛?ㅻ?),
    ('sent',      5, '諛?〓?,   '?몃? 諛???猷')
) AS t(status, sort_order, label_ko, description);

-- 臾몄 ?? 議고??酉?
CREATE OR REPLACE VIEW workflow_v_document_types AS
SELECT * FROM (VALUES
    ('estimate', 1, '寃ъ?',   '?濡???寃ъ 臾몄'),
    ('contract', 2, '怨?쎌',   '怨??愿??臾몄'),
    ('pre_report', 3, '吏? ?ъ 蹂닿??', '諛?대??? ?ъ ???臾몄'),
    ('report',   4, '蹂닿??',   '寃곌낵 蹂닿??')
) AS t(type, sort_order, label_ko, description);

-- ?뱀??≪ 議고??酉?
CREATE OR REPLACE VIEW workflow_v_approval_actions AS
SELECT * FROM (VALUES
    ('approve', 1, '?뱀?,   '臾몄 ?뱀?),
    ('reject',  2, '諛??,   '臾몄 諛??),
    ('cancel',  3, '痍⑥',   '?뱀??泥 痍⑥')
) AS t(action, sort_order, label_ko, description);


-- ============================================================================
-- PART 14: 肄硫??
-- ============================================================================

COMMENT ON FUNCTION get_current_user_organization_id IS '????몄?? ?ъ⑹? 議곗? ID 諛?';
COMMENT ON FUNCTION get_current_user_role IS '????몄?? ?ъ⑹? ?? 諛?';
COMMENT ON FUNCTION is_member_of_organization IS '?ъ⑹媛 ?뱀 議곗?? ???硫ㅻ??몄? ???;
COMMENT ON FUNCTION check_project_status_transition_permission IS '?濡????? ??댁 ?? ?? 湲곕? 沅? 寃利';
COMMENT ON FUNCTION validate_document_can_send IS '臾몄 諛??媛???щ?? ?댁 諛?';

COMMENT ON VIEW workflow_v_project_statuses IS '?濡????? ?? - ?濡?몄? 李몄“??;
COMMENT ON VIEW workflow_v_document_statuses IS '臾몄 ?? ?? - ?濡?몄? 李몄“??;
COMMENT ON VIEW workflow_v_document_types IS '臾몄 ?? ?? - ?濡?몄? 李몄“??;
COMMENT ON VIEW workflow_v_approval_actions IS '?뱀??≪ ?? - ?濡?몄? 李몄“??;
