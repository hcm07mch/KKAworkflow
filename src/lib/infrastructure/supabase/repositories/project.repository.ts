/**
 * Supabase Repository 援ы - Project
 */

import type { SupabaseClient } from '../client';
import type {
  Project,
  ProjectWithRelations,
  JsonObject,
  PaginationParams,
  PaginatedResult,
} from '@/lib/domain/types';
import type { ProjectStatus, ProjectListFilter } from '@/lib/domain/types';
import type { IProjectRepository } from '@/lib/domain/repositories/interfaces';

export class SupabaseProjectRepository implements IProjectRepository {
  constructor(private readonly db: SupabaseClient) {}

  // --------------------------------------------------------------------------
  // Read (?④굔)
  // --------------------------------------------------------------------------

  async findById(id: string): Promise<Project | null> {
    const { data, error } = await this.db
      .from('workflow_projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data as unknown as Project;
  }

  /**
   * ?濡???+ client, owner, documents 議곗?議고
   *
   * Supabase 荑쇰━:
   *   projects(*, clients(*), users!owner_id(*), project_documents(*))
   */
  async findByIdWithRelations(id: string): Promise<ProjectWithRelations | null> {
    const { data, error } = await this.db
      .from('workflow_projects')
      .select(`
        *,
        client:workflow_clients(*),
        owner:workflow_users!workflow_projects_owner_id_fkey(*),
        documents:workflow_project_documents(*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data as unknown as ProjectWithRelations;
  }

  // --------------------------------------------------------------------------
  // Read (紐⑸?)
  // --------------------------------------------------------------------------

  /**
   * 議곗?蹂??濡???紐⑸? (???+ ??댁??ㅼ??
   *
   * Supabase 荑쇰━ 援ъ?
   *   .from('workflow_projects')
   *   .select('*', { count: 'exact' })
   *   .eq('organization_id', ...)
   *   + ?? ???泥댁??
   */
  async findByOrganizationId(
    organizationId: string,
    filter?: ProjectListFilter,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<Project>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.db
      .from('workflow_projects')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId);

    // ?? ??????
    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        query = query.in('status', filter.status);
      } else {
        query = query.eq('status', filter.status);
      }
    }
    if (filter?.client_id) {
      query = query.eq('client_id', filter.client_id);
    }
    if (filter?.owner_id) {
      query = query.eq('owner_id', filter.owner_id);
    }
    if (filter?.search) {
      query = query.or(`title.ilike.%${filter.search}%,code.ilike.%${filter.search}%`);
    }
    if (filter?.start_date_from) {
      query = query.gte('start_date', filter.start_date_from);
    }
    if (filter?.start_date_to) {
      query = query.lte('start_date', filter.start_date_to);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(`projects 議고 ?ㅽ? ${error.message}`);

    const total = count ?? 0;
    return {
      data: (data ?? []) as unknown as Project[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByClientId(clientId: string): Promise<Project[]> {
    const { data, error } = await this.db
      .from('workflow_projects')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`client ?濡???議고 ?ㅽ? ${error.message}`);
    return (data ?? []) as unknown as Project[];
  }

  // --------------------------------------------------------------------------
  // Write
  // --------------------------------------------------------------------------

  async create(data: {
    organization_id: string;
    client_id: string;
    title: string;
    description?: string | null;
    code?: string | null;
    status?: ProjectStatus;
    service_type?: string;
    payment_type?: string;
    owner_id?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    total_amount?: number | null;
    currency?: string;
    metadata?: JsonObject;
  }): Promise<Project> {
    const { data: row, error } = await this.db
      .from('workflow_projects')
      .insert(data)
      .select()
      .single();

    if (error || !row) throw new Error(`project ????ㅽ? ${error?.message}`);
    return row as unknown as Project;
  }

  async update(id: string, data: Partial<{
    title: string;
    description: string | null;
    code: string | null;
    client_id: string;
    status: ProjectStatus;
    service_type: string;
    payment_type: string;
    owner_id: string | null;
    start_date: string | null;
    end_date: string | null;
    total_amount: number | null;
    currency: string;
    metadata: JsonObject;
  }>): Promise<Project> {
    const { data: row, error } = await this.db
      .from('workflow_projects')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error || !row) throw new Error(`project ?? ?ㅽ? ${error?.message}`);
    return row as unknown as Project;
  }
  async recordStatusHistory(data: {
    project_id: string;
    from_status: string;
    to_status: string;
    changed_by: string | null;
    note?: string | null;
  }): Promise<void> {
    await this.db
      .from('workflow_project_status_history')
      .insert({
        project_id: data.project_id,
        from_status: data.from_status,
        to_status: data.to_status,
        changed_by: data.changed_by,
        note: data.note ?? null,
      });
  }}
