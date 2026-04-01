/**
 * Supabase Repository 援ы - ActivityLog
 */

import type { SupabaseClient } from '../client';
import type {
  ActivityLog,
  ActivityLogWithActor,
  JsonObject,
  PaginationParams,
  PaginatedResult,
} from '@/lib/domain/types';
import type { ActivityLogFilter } from '@/lib/domain/types';
import type { IActivityLogRepository } from '@/lib/domain/repositories/interfaces';

export class SupabaseActivityLogRepository implements IActivityLogRepository {
  constructor(private readonly db: SupabaseClient) {}

  // --------------------------------------------------------------------------
  // Read
  // --------------------------------------------------------------------------

  /**
   * ?뱀 ????project, document, approval ?????대?議고
   *
   * Supabase 荑쇰━:
   *   activity_logs WHERE entity_type = ... AND entity_id = ...
   */
  async findByEntity(
    entityType: string,
    entityId: string,
    pagination?: PaginationParams,
  ): Promise<ActivityLog[]> {
    const limit = pagination?.limit ?? 50;
    const page = pagination?.page ?? 1;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error } = await this.db
      .from('workflow_activity_logs')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(`activity logs 議고 ?ㅽ? ${error.message}`);
    return (data ?? []) as unknown as ActivityLog[];
  }

  /**
   * ?濡????泥??대?議고 (project_id濡??곌껐??紐⑤ ??)
   *
   * Supabase 荑쇰━:
   *   activity_logs WHERE project_id = ...
   */
  async findByProjectId(
    projectId: string,
    pagination?: PaginationParams,
  ): Promise<ActivityLog[]> {
    const limit = pagination?.limit ?? 50;
    const page = pagination?.page ?? 1;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error } = await this.db
      .from('workflow_activity_logs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(`project activity logs 議고 ?ㅽ? ${error.message}`);
    return (data ?? []) as unknown as ActivityLog[];
  }

  /**
   * 議곗? ?泥??대?議고 (???+ ??댁??ㅼ??+ actor 議곗?
   *
   * Supabase 荑쇰━:
   *   activity_logs(*, users!actor_id(*)) WHERE organization_id = ...
   */
  async findByOrganizationId(
    organizationId: string,
    filter?: ActivityLogFilter,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<ActivityLogWithActor>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.db
      .from('workflow_activity_logs')
      .select('*, actor:workflow_users!workflow_activity_logs_actor_id_fkey(*)', { count: 'exact' })
      .eq('organization_id', organizationId);

    // ?? ??????
    if (filter?.entity_type) {
      query = query.eq('entity_type', filter.entity_type);
    }
    if (filter?.entity_id) {
      query = query.eq('entity_id', filter.entity_id);
    }
    if (filter?.project_id) {
      query = query.eq('project_id', filter.project_id);
    }
    if (filter?.actor_id) {
      query = query.eq('actor_id', filter.actor_id);
    }
    if (filter?.action) {
      query = query.eq('action', filter.action);
    }
    if (filter?.date_from) {
      query = query.gte('created_at', filter.date_from);
    }
    if (filter?.date_to) {
      query = query.lte('created_at', filter.date_to);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(`organization activity logs 議고 ?ㅽ? ${error.message}`);

    const total = count ?? 0;
    return {
      data: (data ?? []) as unknown as ActivityLogWithActor[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // --------------------------------------------------------------------------
  // Write (INSERT only - ?대? ??/?? 遺?)
  // --------------------------------------------------------------------------

  async create(data: {
    organization_id: string;
    entity_type: string;
    entity_id: string;
    project_id?: string | null;
    action: string;
    actor_id?: string | null;
    description?: string | null;
    old_data?: JsonObject | null;
    new_data?: JsonObject | null;
    metadata?: JsonObject;
  }): Promise<ActivityLog> {
    const { data: row, error } = await this.db
      .from('workflow_activity_logs')
      .insert(data)
      .select()
      .single();

    if (error || !row) throw new Error(`activity log ????ㅽ? ${error?.message}`);
    return row as unknown as ActivityLog;
  }
}
