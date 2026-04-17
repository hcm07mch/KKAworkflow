/**
 * API Route: Project Documents
 * GET    /api/projects/:id/documents        → 프로젝트 문서 목록
 * POST   /api/projects/:id/documents        → 문서 생성
 * DELETE  /api/projects/:id/documents?type=  → 특정 타입 문서 일괄 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;

  const documents = await auth.services.documentRepo.findByProjectId(id);

  return NextResponse.json(documents);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;
  const body = await request.json();

  const result = await auth.services.documentService.createProjectDocument(
    {
      ...body,
      project_id: id,
      organization_id: auth.organizationId,
    },
    { userId: auth.dbUser.id, userRole: auth.role, organizationId: auth.organizationId },
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.data, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;
  const type = request.nextUrl.searchParams.get('type');

  if (!type || !['estimate', 'contract', 'pre_report', 'report', 'payment'].includes(type)) {
    return NextResponse.json(
      { error: { code: 'INVALID_TYPE', message: '유효한 문서 타입을 지정해 주세요.' } },
      { status: 400 },
    );
  }

  const serviceClient = createSupabaseServiceClient();

  // 삭제 전 스토리지 파일 경로 수집 (계약서 등 업로드된 파일 정리)
  const { data: docsToDelete } = await serviceClient
    .from('workflow_project_documents')
    .select('id, content')
    .eq('project_id', id)
    .eq('type', type);

  const filePaths = (docsToDelete ?? [])
    .map((d: any) => d.content?.file_path)
    .filter(Boolean) as string[];

  // 문서 삭제 (cascade로 approvals도 함께 삭제)
  const { data, error } = await serviceClient
    .from('workflow_project_documents')
    .delete()
    .eq('project_id', id)
    .eq('type', type)
    .select('id');

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  // 스토리지 파일 정리
  if (filePaths.length > 0) {
    await serviceClient.storage.from('project-documents').remove(filePaths);
  }

  const deleted = data?.length ?? 0;

  // 활동 로그
  await auth.services.activityLog.log({
    entity_type: 'project',
    entity_id: id,
    project_id: id,
    action: 'documents_deleted',
    actor_id: auth.dbUser.id,
    description: `워크플로우 단계 삭제로 ${type} 문서 ${deleted}건 제거`,
  });

  return NextResponse.json({ success: true, deleted });
}
