/**
 * API Route: Projects
 * GET  /api/projects   ? ?濡???紐⑸? 議고
 * POST /api/projects   ? ?濡??????
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyClientInOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  // 본사 계정이 지사 스코프로 전환한 경우, workflow_users.organization_id(본사)와
  // allowedOrgIds(지사) 가 달라 RLS의 projects_select_same_org 정책에 걸려
  // 빈 결과가 반환되는 문제가 있다. 조직 범위 검증은 allowedOrgIds 필터로
  // 수행하고 있으므로 service client 로 RLS 를 우회한다. (clients API 와 동일 패턴)
  const serviceClient = createSupabaseServiceClient();
  const { allowedOrgIds } = auth;
  const { searchParams } = request.nextUrl;

  const page = Number(searchParams.get('page') ?? 1);
  const limit = Number(searchParams.get('limit') ?? 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  let query = serviceClient
    .from('workflow_projects')
    .select(
      '*, client:workflow_clients(id, name), owner:workflow_users!workflow_projects_owner_id_fkey(id, name)',
      { count: 'exact' },
    )
    .in('organization_id', allowedOrgIds);

  if (status) {
    query = query.in('status', status.split(','));
  }
  if (search) {
    query = query.or(`title.ilike.%${search}%,code.ilike.%${search}%`);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const body = await request.json();

  // client_id가 내 조직 범위에 속하는지 검증
  if (body.client_id) {
    const clientOrgError = await verifyClientInOrg(auth, body.client_id);
    if (clientOrgError) return clientOrgError;
  }

  const result = await auth.services.projectService.createProject(
    {
      ...body,
      organization_id: auth.organizationId,
    },
    { userId: auth.dbUser.id, userRole: auth.role, organizationId: auth.organizationId },
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.data, { status: 201 });
}
