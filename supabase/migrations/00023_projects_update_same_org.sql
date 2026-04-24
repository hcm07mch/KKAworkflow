-- Migration: 00023_projects_update_same_org
-- Purpose: Loosen workflow_projects UPDATE RLS to same-org (owner/role checks 
--          are enforced at API/service layer). 기존에는 member가 오너가 아닌 
--          프로젝트를 업데이트하면 RLS에 막혀 "Cannot coerce the result to a 
--          single JSON object" 500 오류가 발생했다.

DROP POLICY IF EXISTS "projects_update_owner_or_manager" ON workflow_projects;

CREATE POLICY "projects_update_same_org"
    ON workflow_projects FOR UPDATE
    USING (organization_id = get_current_user_organization_id())
    WITH CHECK (organization_id = get_current_user_organization_id());
