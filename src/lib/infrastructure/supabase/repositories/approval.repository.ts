/**
 * Supabase Repository 援ы - DocumentApproval
 */

import type { SupabaseClient } from '../client';
import type {
  DocumentApproval,
  DocumentApprovalWithUsers,
  JsonObject,
} from '@/lib/domain/types';
import type { ApprovalAction } from '@/lib/domain/types';
import type { IApprovalRepository } from '@/lib/domain/repositories/interfaces';

export class SupabaseApprovalRepository implements IApprovalRepository {
  constructor(private readonly db: SupabaseClient) {}

  // --------------------------------------------------------------------------
  // Read (?④굔)
  // --------------------------------------------------------------------------

  async findById(id: string): Promise<DocumentApproval | null> {
    const { data, error } = await this.db
      .from('workflow_document_approvals')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data as unknown as DocumentApproval;
  }

  /**
   * ?뱀 臾몄???湲?以??action = null) ?뱀??泥 議고
   *
   * Supabase 荑쇰━:
   *   document_approvals WHERE document_id = ... AND action IS NULL
   */
  async findPendingByDocumentId(documentId: string): Promise<DocumentApproval | null> {
    const { data, error } = await this.db
      .from('workflow_document_approvals')
      .select('*')
      .eq('document_id', documentId)
      .is('action', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`pending approval 議고 ?ㅽ? ${error.message}`);
    return (data as unknown as DocumentApproval) ?? null;
  }

  // --------------------------------------------------------------------------
  // Read (紐⑸?)
  // --------------------------------------------------------------------------

  async findByDocumentId(documentId: string): Promise<DocumentApproval[]> {
    const { data, error } = await this.db
      .from('workflow_document_approvals')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`approvals 議고 ?ㅽ? ${error.message}`);
    return (data ?? []) as unknown as DocumentApproval[];
  }

  /**
   * ?뱀??대?+ ?泥???뱀???蹂?議곗?議고
   *
   * Supabase 荑쇰━:
   *   document_approvals(*, users!requested_by(*), users!approver_id(*))
   */
  async findByDocumentIdWithUsers(documentId: string): Promise<DocumentApprovalWithUsers[]> {
    const { data, error } = await this.db
      .from('workflow_document_approvals')
      .select(`
        *,
        requester:workflow_users!workflow_document_approvals_requested_by_fkey(*),
        approver:workflow_users!workflow_document_approvals_approver_id_fkey(*)
      `)
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`approvals with users 議고 ?ㅽ? ${error.message}`);
    return (data ?? []) as unknown as DocumentApprovalWithUsers[];
  }

  // --------------------------------------------------------------------------
  // Write
  // --------------------------------------------------------------------------

  async create(data: {
    document_id: string;
    requested_by?: string | null;
    requested_at?: string;
    step?: number;
    comment?: string | null;
    metadata?: JsonObject;
  }): Promise<DocumentApproval> {
    const { data: row, error } = await this.db
      .from('workflow_document_approvals')
      .insert(data)
      .select()
      .single();

    if (error || !row) throw new Error(`approval ????ㅽ? ${error?.message}`);
    return row as unknown as DocumentApproval;
  }

  async update(id: string, data: Partial<{
    approver_id: string | null;
    action: ApprovalAction | null;
    actioned_at: string | null;
    comment: string | null;
  }>): Promise<DocumentApproval> {
    const { data: row, error } = await this.db
      .from('workflow_document_approvals')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error || !row) throw new Error(`approval ?? ?ㅽ? ${error?.message}`);
    return row as unknown as DocumentApproval;
  }
}
