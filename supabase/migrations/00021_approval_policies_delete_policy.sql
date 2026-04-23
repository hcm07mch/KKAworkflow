-- ============================================================================
-- Add missing DELETE RLS policy for workflow_approval_policies
--
-- Bug: DELETE /api/settings/approval-policies/:id silently affected 0 rows
-- because workflow_approval_policies has RLS enabled but no FOR DELETE policy.
-- Migration 00003 only defined SELECT / INSERT / UPDATE policies, and
-- migration 00012 added DELETE only for the child workflow_approval_policy_steps
-- table. Under RLS the missing policy means the parent row is never deleted,
-- so the record reappears on page refresh.
-- ============================================================================

CREATE POLICY "approval_policies_delete" ON workflow_approval_policies
    FOR DELETE USING (
        organization_id = get_current_user_organization_id()
        AND get_current_user_role() = 'admin'
    );
