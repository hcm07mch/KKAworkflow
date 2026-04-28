/**
 * API Route: Single Document
 * GET    /api/documents/:documentId → 문서 조회
 * PUT    /api/documents/:documentId → 문서 내용 수정 (draft 상태에서만)
 * DELETE /api/documents/:documentId → 문서 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyDocumentInOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { documentId } = await params;
  const doc = await auth.services.documentRepo.findById(documentId);

  if (!doc) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '문서를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }

  return NextResponse.json(doc);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { documentId } = await params;
  const body = await request.json();

  const orgError = await verifyDocumentInOrg(auth, documentId);
  if (orgError) return orgError;

  const existing = await auth.services.documentRepo.findById(documentId);
  if (!existing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '문서를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }

  if (existing.status !== 'draft' && existing.type !== 'payment') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '작성중 상태의 문서만 수정할 수 있습니다' } },
      { status: 403 },
    );
  }

  // 담당자(프로젝트 소유자)만 수정 가능
  // 단, 입금(payment) 문서는 회계 담당(manager/admin)도 확인·번복할 수 있도록 허용.
  const project = await auth.services.projectRepo.findById(existing.project_id);
  const isOwner = !project?.owner_id || project.owner_id === auth.dbUser.id;
  const isAccountingRole = auth.role === 'manager' || auth.role === 'admin';
  const isPaymentDoc = existing.type === 'payment';
  if (!isOwner && !(isPaymentDoc && isAccountingRole)) {
    return NextResponse.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: isPaymentDoc
            ? '담당자 또는 회계 담당(매니저/관리자)만 입금 문서를 수정할 수 있습니다'
            : '담당자만 견적서를 수정할 수 있습니다',
        },
      },
      { status: 403 },
    );
  }

  const updated = await auth.services.documentRepo.update(documentId, {
    content: body.content,
    ...(body.title ? { title: body.title } : {}),
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { documentId } = await params;

  const orgError = await verifyDocumentInOrg(auth, documentId);
  if (orgError) return orgError;

  const doc = await auth.services.documentRepo.findById(documentId);
  if (!doc) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '문서를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }

  // 권한 체크: admin/manager 또는 프로젝트 owner / 담당자(assignee).
  // (기존 RLS 정책은 admin + draft 만 허용하지만, 실제 운영상 워크플로우 단계 삭제 시
  //  매니저/담당자가 함께 문서를 정리할 수 있어야 하므로 API 레이어에서 더 넓게 허용한다.)
  const project = await auth.services.projectRepo.findById(doc.project_id);
  const isPrivileged = auth.role === 'admin' || auth.role === 'manager';
  const isOwner = !!project && project.owner_id === auth.dbUser.id;
  let isAssignee = false;
  if (!isPrivileged && !isOwner) {
    const assignees = await auth.services.assigneeRepo.findByProjectId(doc.project_id);
    isAssignee = assignees.some((a) => a.user_id === auth.dbUser.id);
  }
  if (!isPrivileged && !isOwner && !isAssignee) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '문서를 삭제할 권한이 없습니다' } },
      { status: 403 },
    );
  }

  // 스토리지 파일 정리 + 실제 삭제는 service client 로 수행하여 RLS(admin+draft 제한)를 우회.
  // 조직 경계는 위의 verifyDocumentInOrg 가 이미 검증했고, 권한은 위에서 검증했다.
  const serviceClient = createSupabaseServiceClient();
  const content = doc.content as Record<string, unknown>;
  const filePath = content?.file_path as string | undefined;
  const pdfPath = content?.pdf_path as string | undefined;
  const storagePaths = [filePath, pdfPath].filter((p): p is string => !!p);
  if (storagePaths.length > 0) {
    try {
      await serviceClient.storage.from('project-documents').remove(storagePaths);
    } catch { /* ignore */ }
  }

  // 문서 삭제 (cascade로 approvals도 삭제)
  const { error: deleteError } = await serviceClient
    .from('workflow_project_documents')
    .delete()
    .eq('id', documentId);

  if (deleteError) {
    return NextResponse.json(
      { error: { code: 'DELETE_FAILED', message: deleteError.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ deleted: documentId });
}
