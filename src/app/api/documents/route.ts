/**
 * API Route: Documents (org-wide)
 * GET  /api/documents?type=estimate|contract|pre_report|report|payment
 * POST /api/documents  — 문서 직접 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyProjectInOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';
import { DOCUMENT_TYPES } from '@/lib/domain/types';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  // 본사 계정이 지사 스코프로 전환한 경우 workflow_users.organization_id(본사) 와
  // allowedOrgIds(지사) 가 달라 RLS(projects_select_same_org / documents 관련 정책) 에
  // 막혀 빈 결과가 반환된다. 조직 경계는 allowedOrgIds 필터로 보장되므로 서비스
  // 클라이언트로 RLS 를 우회한다. (clients / projects API 와 동일 패턴)
  const serviceClient = createSupabaseServiceClient();
  const { allowedOrgIds } = auth;
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type');

  // 1) 먼저 허용 조직 범위의 프로젝트 ID를 조회한다.
  //    (문서를 project.organization_id 로 필터링하는 것은 PostgREST의 embed 필터 특성상
  //     `!inner`와 조합해도 안정적으로 적용되지 않는 경우가 있어, project_id 화이트리스트로 처리한다.)
  const { data: projectRows, error: projectError } = await serviceClient
    .from('workflow_projects')
    .select('id')
    .in('organization_id', allowedOrgIds);

  if (projectError) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: projectError.message } },
      { status: 500 },
    );
  }

  const allowedProjectIds = (projectRows ?? []).map((p: { id: string }) => p.id);
  if (allowedProjectIds.length === 0) {
    return NextResponse.json([]);
  }

  let query = serviceClient
    .from('workflow_project_documents')
    .select(
      '*, segment:workflow_project_segments(flow_number, group_key, position), project:workflow_projects(id, title, organization_id, service_type, total_amount, start_date, end_date, status, client:workflow_clients(id, name), owner:workflow_users!workflow_projects_owner_id_fkey(id, name))',
    )
    .in('project_id', allowedProjectIds);

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/documents
 * body: { project_id, type, title, content? }
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const body = await request.json();
  const { project_id, type, title, content } = body;

  if (!project_id || !type || !title) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'project_id, type, title은 필수입니다.' } },
      { status: 400 },
    );
  }

  if (!DOCUMENT_TYPES.includes(type)) {
    return NextResponse.json(
      { error: { code: 'INVALID_TYPE', message: '유효하지 않은 문서 타입입니다.' } },
      { status: 400 },
    );
  }

  // 프로젝트가 내 조직 범위 안에 속하는지 검증
  const orgError = await verifyProjectInOrg(auth, project_id);
  if (orgError) return orgError;

  const ctx = { userId: auth.dbUser.id, userRole: auth.role, organizationId: auth.organizationId };

  const result = await auth.services.documentService.createProjectDocument(
    { project_id, type, title, content: content ?? {} },
    ctx,
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data, { status: 201 });
}
