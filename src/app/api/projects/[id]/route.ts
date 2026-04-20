/**
 * API Route: Single Project
 * GET   /api/projects/:id  ? ?濡??????議고
 * PATCH /api/projects/:id  ? ?濡?????
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyProjectInOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;

  const orgError = await verifyProjectInOrg(auth, id);
  if (orgError) return orgError;

  const project = await auth.services.projectRepo.findByIdWithRelations(id);

  if (!project) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '?濡??몃? 李얠 ? ??듬??' } },
      { status: 404 },
    );
  }
  return NextResponse.json(project);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;
  const body = await request.json();

  const orgError2 = await verifyProjectInOrg(auth, id);
  if (orgError2) return orgError2;

  const result = await auth.services.projectService.updateProject(
    id,
    body,
    { userId: auth.dbUser.id, userRole: auth.role, organizationId: auth.organizationId },
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // ── 문서 자동 생성은 제거됨 ──
  // 문서는 이제 클라이언트의 handleWorkflowAdd에서 POST /api/documents로 직접 생성.
  // 동일 그룹의 플로우가 여러 개 추가될 수 있으므로, 매 플로우마다 새 문서를 생성한다.

  return NextResponse.json(result.data);
}

/**
 * DELETE /api/projects/:id
 * 프로젝트 영구 삭제 (admin/manager 전용).
 * FK ON DELETE CASCADE로 연관 데이터(문서/승인/이력/환불/배정/알림)는 함께 삭제된다.
 * Storage에 업로드된 문서 파일은 함께 삭제된다(best-effort).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;

  const orgError = await verifyProjectInOrg(auth, id);
  if (orgError) return orgError;

  // 삭제 권한: admin/manager, 또는 프로젝트 담당자(owner) 본인
  const project = await auth.services.projectRepo.findById(id);
  const isPrivileged = auth.role === 'admin' || auth.role === 'manager';
  const isOwner = !!project && project.owner_id === auth.dbUser.id;
  if (!isPrivileged && !isOwner) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '프로젝트 삭제 권한이 없습니다 (담당자 또는 관리자만 가능)' } },
      { status: 403 },
    );
  }

  const serviceClient = createSupabaseServiceClient();

  // 1) 삭제 전 관련 Storage 파일 경로 수집
  const { data: docs } = await serviceClient
    .from('workflow_project_documents')
    .select('content')
    .eq('project_id', id);

  const storagePaths: string[] = [];
  for (const doc of (docs ?? []) as { content: Record<string, unknown> | null }[]) {
    const content = doc.content ?? {};
    const filePath = content.file_path as string | undefined;
    const pdfPath = content.pdf_path as string | undefined;
    if (filePath) storagePaths.push(filePath);
    if (pdfPath) storagePaths.push(pdfPath);
  }

  // 2) 프로젝트 삭제 (FK CASCADE로 연관 레코드 삭제)
  const { error: deleteError } = await serviceClient
    .from('workflow_projects')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json(
      { error: { code: 'DELETE_FAILED', message: deleteError.message } },
      { status: 500 },
    );
  }

  // 3) Storage 파일 정리 (best-effort)
  if (storagePaths.length > 0) {
    await serviceClient.storage
      .from('project-documents')
      .remove(storagePaths)
      .catch((e) => console.warn('[project-delete] Storage cleanup failed:', e));
  }

  return NextResponse.json({ success: true });
}
