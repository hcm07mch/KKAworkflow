/**
 * Supabase Repository 援ы - Notification
 */

import type { SupabaseClient } from '../client';
import type {
  Notification,
  NotificationWithProject,
  PaginationParams,
} from '@/lib/domain/types';
import type { INotificationRepository } from '@/lib/domain/repositories/interfaces';

export class SupabaseNotificationRepository implements INotificationRepository {
  // NOTE: workflow_notifications ??대???database.types.ts? 諛??湲??源吏 any 罹?ㅽ ?ъ?
  // db:gen ?ㅽ ? ?嫄?媛??
  constructor(private readonly db: SupabaseClient) {}

  private get table() {
    return (this.db as any).from('workflow_notifications');
  }

  async findByRecipientId(
    recipientId: string,
    pagination?: PaginationParams,
  ): Promise<NotificationWithProject[]> {
    const limit = pagination?.limit ?? 30;
    const page = pagination?.page ?? 1;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error } = await this.table
      .select(`
        *,
        project:workflow_projects!workflow_notifications_project_id_fkey(id, title, code, status)
      `)
      .eq('recipient_id', recipientId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(`?由?議고 ?ㅽ? ${error.message}`);
    return (data ?? []) as unknown as NotificationWithProject[];
  }

  async countUnread(recipientId: string): Promise<number> {
    const { count, error } = await this.table
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', recipientId)
      .eq('is_read', false);

    if (error) throw new Error(`?쎌? ?? ?由?? 議고 ?ㅽ? ${error.message}`);
    return count ?? 0;
  }

  async markAsRead(id: string): Promise<Notification> {
    const { data, error } = await this.table
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`?由??쎌 泥由??ㅽ? ${error.message}`);
    return data as unknown as Notification;
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    const { error } = await this.table
      .update({ is_read: true })
      .eq('recipient_id', recipientId)
      .eq('is_read', false);

    if (error) throw new Error(`?泥??쎌 泥由??ㅽ? ${error.message}`);
  }

  async create(data: {
    organization_id: string;
    recipient_id: string;
    project_id?: string | null;
    type: string;
    title: string;
    body?: string | null;
    link?: string | null;
  }): Promise<Notification> {
    const { data: row, error } = await this.table
      .insert(data)
      .select()
      .single();

    if (error) throw new Error(`?由?????ㅽ? ${error.message}`);
    return row as unknown as Notification;
  }
}
