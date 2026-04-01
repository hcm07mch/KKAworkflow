/**
 * Supabase Repository 援ы - ApprovalPolicy
 */

import type { SupabaseClient } from '../client';
import type { ApprovalPolicyWithSteps } from '@/lib/domain/types';
import type { IApprovalPolicyRepository } from '@/lib/domain/repositories/interfaces';

export class SupabaseApprovalPolicyRepository implements IApprovalPolicyRepository {
  constructor(private readonly db: SupabaseClient) {}

  // --------------------------------------------------------------------------
  // Read
  // --------------------------------------------------------------------------

  async findByOrgAndType(
    organizationId: string,
    documentType: string | null,
  ): Promise<ApprovalPolicyWithSteps | null> {
    let query = this.db
      .from('workflow_approval_policies')
      .select('*, steps:workflow_approval_policy_steps(*)')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (documentType === null) {
      query = query.is('document_type', null);
    } else {
      query = query.eq('document_type', documentType);
    }

    const { data, error } = await query
      .order('step', { referencedTable: 'workflow_approval_policy_steps', ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`approval policy 議고 ?ㅽ? ${error.message}`);
    return (data as unknown as ApprovalPolicyWithSteps) ?? null;
  }

  async findByIdWithSteps(id: string): Promise<ApprovalPolicyWithSteps | null> {
    const { data, error } = await this.db
      .from('workflow_approval_policies')
      .select('*, steps:workflow_approval_policy_steps(*)')
      .eq('id', id)
      .order('step', { referencedTable: 'workflow_approval_policy_steps', ascending: true })
      .single();

    if (error || !data) return null;
    return data as unknown as ApprovalPolicyWithSteps;
  }

  async findByOrganizationId(organizationId: string): Promise<ApprovalPolicyWithSteps[]> {
    const { data, error } = await this.db
      .from('workflow_approval_policies')
      .select('*, steps:workflow_approval_policy_steps(*)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true })
      .order('step', { referencedTable: 'workflow_approval_policy_steps', ascending: true });

    if (error) throw new Error(`approval policies 議고 ?ㅽ? ${error.message}`);
    return (data ?? []) as unknown as ApprovalPolicyWithSteps[];
  }

  // --------------------------------------------------------------------------
  // Write
  // --------------------------------------------------------------------------

  async create(data: {
    organization_id: string;
    document_type?: string | null;
    required_steps: number;
    description?: string | null;
    is_active?: boolean;
    steps: { step: number; required_role: string; label?: string | null; assigned_user_id?: string | null }[];
  }): Promise<ApprovalPolicyWithSteps> {
    const { steps, ...policyData } = data;

    // ?梨 ???
    const { data: policy, error: policyError } = await this.db
      .from('workflow_approval_policies')
      .insert({
        organization_id: policyData.organization_id,
        document_type: policyData.document_type ?? null,
        required_steps: policyData.required_steps,
        description: policyData.description ?? null,
        is_active: policyData.is_active ?? true,
      })
      .select()
      .single();

    if (policyError || !policy) {
      throw new Error(`approval policy ????ㅽ? ${policyError?.message}`);
    }

    // ?④? ???
    if (steps.length > 0) {
      const stepsToInsert = steps.map(s => ({
        policy_id: policy.id,
        step: s.step,
        required_role: s.required_role,
        label: s.label ?? null,
        assigned_user_id: s.assigned_user_id ?? null,
      }));

      const { error: stepsError } = await this.db
        .from('workflow_approval_policy_steps')
        .insert(stepsToInsert);

      if (stepsError) {
        throw new Error(`approval policy steps ????ㅽ? ${stepsError.message}`);
      }
    }

    // ?泥??梨 + ?④? 諛?
    return (await this.findByIdWithSteps(policy.id))!;
  }

  async update(id: string, data: Partial<{
    required_steps: number;
    description: string | null;
    is_active: boolean;
  }>): Promise<ApprovalPolicyWithSteps> {
    const { error } = await this.db
      .from('workflow_approval_policies')
      .update(data)
      .eq('id', id);

    if (error) throw new Error(`approval policy ?? ?ㅽ? ${error.message}`);
    return (await this.findByIdWithSteps(id))!;
  }

  async delete(id: string): Promise<void> {
    // steps??ON DELETE CASCADE
    const { error } = await this.db
      .from('workflow_approval_policies')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`approval policy ?? ?ㅽ? ${error.message}`);
  }
}
