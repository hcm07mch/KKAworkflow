/**
 * Supabase Repository 援ы - ProjectDocument
 */

import type { SupabaseClient } from '../client';
import type {
  ProjectDocument,
  ProjectDocumentWithRelations,
  JsonObject,
  PaginationParams,
  PaginatedResult,
} from '@/lib/domain/types';
import type { DocumentStatus, DocumentType, DocumentListFilter } from '@/lib/domain/types';
import type { IDocumentRepository } from '@/lib/domain/repositories/interfaces';

export class SupabaseDocumentRepository implements IDocumentRepository {
  constructor(private readonly db: SupabaseClient) {}

  // --------------------------------------------------------------------------
  // Read (?④굔)
  // --------------------------------------------------------------------------

  async findById(id: string): Promise<ProjectDocument | null> {
    const { data, error } = await this.db
      .from('workflow_project_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data as unknown as ProjectDocument;
  }

  /**
   * 臾몄 + project, creator, sender, approvals 議곗?議고
   *
   * Supabase 荑쇰━:
   *   project_documents(*, projects(*), users!created_by(*), users!sent_by(*), document_approvals(*))
   */
  async findByIdWithRelations(id: string): Promise<ProjectDocumentWithRelations | null> {
    const { data, error } = await this.db
      .from('workflow_project_documents')
      .select(`
        *,
        project:workflow_projects(*),
        creator:workflow_users!workflow_project_documents_created_by_fkey(*),
        sender:workflow_users!workflow_project_documents_sent_by_fkey(*),
        approvals:workflow_document_approvals(*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) return null;

    // latest_approval 怨??
    const approvals = (data as any).approvals ?? [];
    const latest = approvals.length > 0
      ? approvals[approvals.length - 1]
      : null;

    return {
      ...(data as any),
      latest_approval: latest,
    } as unknown as ProjectDocumentWithRelations;
  }

  // --------------------------------------------------------------------------
  // Read (紐⑸?)
  // --------------------------------------------------------------------------

  async findByProjectId(
    projectId: string,
    filter?: Omit<DocumentListFilter, 'project_id'>,
  ): Promise<ProjectDocument[]> {
    let query = this.db
      .from('workflow_project_documents')
      .select('*')
      .eq('project_id', projectId);

    if (filter?.type) {
      if (Array.isArray(filter.type)) {
        query = query.in('type', filter.type);
      } else {
        query = query.eq('type', filter.type);
      }
    }
    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        query = query.in('status', filter.status);
      } else {
        query = query.eq('status', filter.status);
      }
    }
    if (filter?.is_sent !== undefined) {
      query = query.eq('is_sent', filter.is_sent);
    }
    if (filter?.created_by) {
      query = query.eq('created_by', filter.created_by);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw new Error(`documents 議고 ?ㅽ? ${error.message}`);
    return (data ?? []) as unknown as ProjectDocument[];
  }

  /**
   * 議곗? ?泥?臾몄 紐⑸? (Dashboard ?깆???ъ?
   *
   * Supabase 荑쇰━:
   *   project_documents 議곗?projects WHERE projects.organization_id = ...
   */
  async findByOrganizationId(
    organizationId: string,
    filter?: DocumentListFilter,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<ProjectDocument>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.db
      .from('workflow_project_documents')
      .select('*, project:projects!inner(organization_id)', { count: 'exact' })
      .eq('project.organization_id', organizationId);

    if (filter?.project_id) {
      query = query.eq('project_id', filter.project_id);
    }
    if (filter?.type) {
      if (Array.isArray(filter.type)) {
        query = query.in('type', filter.type);
      } else {
        query = query.eq('type', filter.type);
      }
    }
    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        query = query.in('status', filter.status);
      } else {
        query = query.eq('status', filter.status);
      }
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(`議곗? documents 議고 ?ㅽ? ${error.message}`);

    const total = count ?? 0;
    return {
      data: (data ?? []) as unknown as ProjectDocument[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // --------------------------------------------------------------------------
  // Read (吏怨)
  // --------------------------------------------------------------------------

  async countByProjectIdAndType(projectId: string, type: DocumentType): Promise<number> {
    const { count, error } = await this.db
      .from('workflow_project_documents')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('type', type);

    if (error) throw new Error(`document 移댁???ㅽ? ${error.message}`);
    return count ?? 0;
  }

  // --------------------------------------------------------------------------
  // Write
  // --------------------------------------------------------------------------

  async create(data: {
    project_id: string;
    type: DocumentType;
    title: string;
    status?: DocumentStatus;
    version?: number;
    content?: JsonObject;
    created_by?: string | null;
    metadata?: JsonObject;
  }): Promise<ProjectDocument> {
    const { data: row, error } = await this.db
      .from('workflow_project_documents')
      .insert(data)
      .select()
      .single();

    if (error || !row) throw new Error(`document ????ㅽ? ${error?.message}`);
    return row as unknown as ProjectDocument;
  }

  async update(id: string, data: Partial<{
    title: string;
    status: DocumentStatus;
    version: number;
    content: JsonObject;
    is_sent: boolean;
    sent_at: string | null;
    sent_by: string | null;
    sent_to: string | null;
    metadata: JsonObject;
  }>): Promise<ProjectDocument> {
    const { data: row, error } = await this.db
      .from('workflow_project_documents')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error || !row) throw new Error(`document ?? ?ㅽ? ${error?.message}`);
    return row as unknown as ProjectDocument;
  }
}
