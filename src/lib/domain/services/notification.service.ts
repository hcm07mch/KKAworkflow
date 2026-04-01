/**
 * Notification Service
 *
 * ?由???? 議고, ?쎌 泥由?
 * ?濡????? 蹂寃?? ?대뱀?寃 ?由????
 */

import type { INotificationRepository } from '@/lib/domain/repositories/interfaces';
import type { IProjectAssigneeRepository } from '@/lib/domain/repositories/interfaces';
import type {
  Notification,
  NotificationWithProject,
  NotificationType,
  PaginationParams,
} from '@/lib/domain/types';

export class NotificationService {
  constructor(
    private readonly notificationRepo: INotificationRepository,
    private readonly assigneeRepo: IProjectAssigneeRepository,
    private readonly organizationId: string,
  ) {}

  // --------------------------------------------------------------------------
  // 議고
  // --------------------------------------------------------------------------

  async getMyNotifications(
    userId: string,
    pagination?: PaginationParams,
  ): Promise<NotificationWithProject[]> {
    return this.notificationRepo.findByRecipientId(userId, pagination);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.countUnread(userId);
  }

  // --------------------------------------------------------------------------
  // ?쎌 泥由?
  // --------------------------------------------------------------------------

  async markAsRead(notificationId: string): Promise<Notification> {
    return this.notificationRepo.markAsRead(notificationId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    return this.notificationRepo.markAllAsRead(userId);
  }

  // --------------------------------------------------------------------------
  // ?由?諛??(?濡????대뱀?寃)
  // --------------------------------------------------------------------------

  /**
   * ?濡????대뱀?寃 ?由쇱 蹂대???
   * excludeUserId: ?由쇱 蹂대??뱀ъ? ???
   */
  async notifyProjectAssignees(params: {
    projectId: string;
    projectTitle: string;
    type: NotificationType;
    title: string;
    body?: string;
    excludeUserId?: string;
  }): Promise<void> {
    const assignees = await this.assigneeRepo.findByProjectId(params.projectId);
    const recipients = assignees
      .map((a) => a.user_id)
      .filter((uid) => uid !== params.excludeUserId);

    const link = `/projects/${params.projectId}`;

    await Promise.allSettled(
      recipients.map((recipientId) =>
        this.notificationRepo.create({
          organization_id: this.organizationId,
          recipient_id: recipientId,
          project_id: params.projectId,
          type: params.type,
          title: params.title,
          body: params.body ?? null,
          link,
        }),
      ),
    );
  }

  /**
   * ?뱀 ?ъ⑹?寃 1嫄??由?
   */
  async notifyUser(params: {
    recipientId: string;
    projectId?: string;
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
  }): Promise<Notification> {
    return this.notificationRepo.create({
      organization_id: this.organizationId,
      recipient_id: params.recipientId,
      project_id: params.projectId ?? null,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
    });
  }
}
