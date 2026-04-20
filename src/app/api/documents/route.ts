/**
 * API Route: Documents (org-wide)
 * GET  /api/documents?type=estimate|contract|pre_report|report|payment
 * POST /api/documents  — 문서 직접 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyProjectInOrg } from '@/lib/auth';
import { DOCUMENT_TYPES } from '@/lib/domain/types';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { supabase, allowedOrgIds } = auth;
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type');

  let query = supabase
    .from('workflow_project_documents')
    .select(
      '*, project:workflow_projects!inner(id, title, organization_id, service_type, total_amount, start_date, end_date, status, client:workflow_clients(id, name), owner:workflow_users!workflow_projects_owner_id_fkey(id, name))',
    )
    .in('project.organization_id', allowedOrgIds);

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
