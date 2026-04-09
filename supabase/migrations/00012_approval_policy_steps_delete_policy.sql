-- ============================================================================
-- Add missing DELETE RLS policy for workflow_approval_policy_steps
-- Without this, the PUT /api/settings/approval-policies/:id endpoint
-- cannot delete old steps before re-inserting updated ones.
-- ============================================================================

CREATE POLICY "approval_policy_steps_delete" ON workflow_approval_policy_steps
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM workflow_approval_policies ap
            WHERE ap.id = workflow_approval_policy_steps.policy_id
            AND ap.organization_id = get_current_user_organization_id()
        )
        AND get_current_user_role() = 'admin'
    );
