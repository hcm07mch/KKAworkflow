/**
 * Supabase Repository 援ы - ProjectAssignee
 */

import type { SupabaseClient } from '../client';
import type {
  ProjectAssignee,
  ProjectAssigneeWithUser,
} from '@/lib/domain/types';
import type { IProjectAssigneeRepository } from '@/lib/domain/repositories/interfaces';

export class SupabaseProjectAssigneeRepository implements IProjectAssigneeRepository {
  // NOTE: workflow_project_assignees ??대???database.types.ts? 諛??湲??源吏 any 罹?ㅽ ?ъ?
  constructor(private readonly db: SupabaseClient) {}

  private get table() {
    return (this.db as any).from('workflow_project_assignees');
  }

  async findByProjectId(projectId: string): Promise<ProjectAssigneeWithUser[]> {
    const { data, error } = await this.table
      .select(`
        *,
        user:workflow_users!workflow_project_assignees_user_id_fkey(id, name, email, role, is_active)
      `)
      .eq('project_id', projectId)
      .order('assigned_at', { ascending: true });

    if (error) throw new Error(`?濡????대뱀 議고 ?ㅽ? ${error.message}`);
    return (data ?? []) as unknown as ProjectAssigneeWithUser[];
  }

  async findByUserId(userId: string): Promise<ProjectAssignee[]> {
    const { data, error } = await this.table
      .select('*')
      .eq('user_id', userId);

    if (error) throw new Error(`?ъ⑹ 諛곗 ?濡???議고 ?ㅽ? ${error.message}`);
    return (data ?? []) as unknown as ProjectAssignee[];
  }

  async add(data: {
    project_id: string;
    user_id: string;
    role?: string;
    assigned_by?: string | null;
  }): Promise<ProjectAssignee> {
    const { data: row, error } = await this.table
      .upsert(
        {
          project_id: data.project_id,
          user_id: data.user_id,
          role: data.role ?? 'member',
          assigned_by: data.assigned_by ?? null,
        },
        { onConflict: 'project_id,user_id' },
      )
      .select()
      .single();

    if (error) throw new Error(`?대뱀 諛곗 ?ㅽ? ${error.message}`);
    return row as unknown as ProjectAssignee;
  }

  async remove(projectId: string, userId: string): Promise<void> {
    const { error } = await this.table
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) throw new Error(`?대뱀 ?댁 ?ㅽ? ${error.message}`);
  }
}
