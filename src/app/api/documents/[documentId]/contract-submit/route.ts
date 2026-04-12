/**
 * API Route: Contract Submit (계약서 제출)
 * POST /api/documents/:documentId/contract-submit
 *
 * 1. 문서 상태를 in_review로 전환
 * 2. 프로젝트 상태를 C2_contract_review(계약 승인)로 전환
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { documentId } = await params;
  const ctx = {
    userId: auth.dbUser.id,
    userRole: auth.role,
    organizationId: auth.organizationId,
  };

  try {
    const existingDoc = await auth.services.documentRepo.findById(documentId);
    if (!existingDoc) {
      return NextResponse.json(
        { error: { code: 'DOCUMENT_NOT_FOUND', message: '문서를 찾을 수 없습니다' } },
        { status: 404 },
      );
    }

    // 계약서 파일이 업로드되어 있는지 확인
    const content = existingDoc.content as Record<string, unknown>;
    if (!content?.file_path) {
      return NextResponse.json(
        { error: { code: 'NO_FILE', message: '계약서 파일을 먼저 업로드해주세요' } },
        { status: 400 },
      );
    }

    // 담당자(프로젝트 소유자)만 제출 가능
    const ownerProject = await auth.services.projectRepo.findById(existingDoc.project_id);
    if (ownerProject && ownerProject.owner_id && ownerProject.owner_id !== ctx.userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: '담당자만 계약서를 제출할 수 있습니다' } },
        { status: 403 },
      );
    }

    let finalDoc = existingDoc;

    if (existingDoc.status === 'draft') {
      // 이전 재작성 등으로 남아있는 대기 중 승인 요청이 있으면 자동 취소
      const staleApproval = await auth.services.approvalRepo.findPendingByDocumentId(documentId);
      if (staleApproval) {
        await auth.services.approvalRepo.update(staleApproval.id, {
          approver_id: ctx.userId,
          action: 'cancel',
          actioned_at: new Date().toISOString(),
          comment: '재제출로 인한 자동 취소',
        });
      }

      const approvalResult = await auth.services.approvalService.requestDocumentApproval(
        { document_id: documentId },
        ctx,
      );

      if (!approvalResult.success) {
        console.error('[contract-submit] Approval request failed:', approvalResult.error);
        return NextResponse.json({ error: approvalResult.error }, { status: 400 });
      }

      finalDoc = (await auth.services.documentRepo.findById(documentId)) ?? existingDoc;
    }

    // 프로젝트 상태를 C2_contract_review로 전환
    const projectId = finalDoc.project_id;
    const project = await auth.services.projectRepo.findById(projectId);

    if (project && project.status !== 'C2_contract_review') {
      const projectResult = await auth.services.projectService.transitionStatus(
        { project_id: projectId, to_status: 'C2_contract_review', reason: '계약서 제출' },
        ctx,
      );

      if (!projectResult.success) {
        console.error('[contract-submit] Project transition failed:', projectResult.error);
        return NextResponse.json({ error: projectResult.error }, { status: 400 });
      }
    }

    return NextResponse.json({
      document: finalDoc,
      project: project,
    });
  } catch (err) {
    console.error('[contract-submit] Unhandled error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      { status: 500 },
    );
  }
}
