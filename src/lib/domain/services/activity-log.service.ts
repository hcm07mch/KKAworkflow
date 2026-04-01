/**
 * ActivityLog Service
 *
 * 紐⑤ 二쇱 ??瑜?湲곕??? ?鍮??
 * ?ㅻⅨ ?鍮?ㅼ? ?대???쇰? ?몄???
 */

import type { ActivityLog } from '../types';
import type { CreateActivityLogInput } from '../types';
import type { IActivityLogRepository } from '../repositories/interfaces';

export class ActivityLogService {
  constructor(
    private readonly activityLogRepo: IActivityLogRepository,
    private readonly organizationId: string,
  ) {}

  /**
   * ?대?湲곕?
   *
   * 鍮利???洹移:
   * - organization_id? ?鍮?ㅼ? ?? 二쇱
   * - ?ㅽ⑦대 ?몄??? ?몃??? 濡ㅻ갚?吏 ?? (best-effort)
   */
  async log(input: CreateActivityLogInput): Promise<ActivityLog> {
    return this.activityLogRepo.create({
      organization_id: this.organizationId,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      project_id: input.project_id ?? null,
      action: input.action,
      actor_id: input.actor_id ?? null,
      description: input.description ?? null,
      old_data: input.old_data ?? null,
      new_data: input.new_data ?? null,
      metadata: input.metadata ?? {},
    });
  }

  /**
   * ?뱀 ??고곗 ?대?議고
   */
  async getByEntity(entityType: string, entityId: string): Promise<ActivityLog[]> {
    return this.activityLogRepo.findByEntity(entityType, entityId);
  }

  /**
   * ?濡????泥??대?議고 (?濡???+ ?? 臾몄/?뱀???
   */
  async getByProjectId(projectId: string): Promise<ActivityLog[]> {
    return this.activityLogRepo.findByProjectId(projectId);
  }
}
