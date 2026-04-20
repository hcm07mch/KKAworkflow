/**
 * API Route: Project Status History
 * GET /api/projects/:id/status-history?limit=20&cursor=<created_at>
 *
 * 프로젝트 상태 변경 이력을 최신순으로 조회합니다.
 * cursor 기반 페이지네이션을 지원합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyProjectInOrg } from '@/lib/auth';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id: projectId } = await params;
  const { searchParams } = request.nextUrl;

  const orgError = await verifyProjectInOrg(auth, projectId);
  if (orgError) return orgError;

  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') ?? '', 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const cursor = searchParams.get('cursor'); // ISO datetime string

  let query = auth.supabase
    .from('workflow_project_status_history')
    .select('id, from_status, to_status, note, created_at, changed_by, user:workflow_users!workflow_project_status_history_changed_by_fkey(name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit + 1); // +1 to check if there are more

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: { code: 'QUERY_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;

  return NextResponse.json({
    items: items.map((row: any) => ({
      id: row.id,
      from_status: row.from_status,
      to_status: row.to_status,
      note: row.note,
      created_at: row.created_at,
      changed_by_name: row.user?.name ?? null,
    })),
    nextCursor,
    hasMore,
  });
}
