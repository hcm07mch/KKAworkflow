/**
 * API Route: Document Re-draft (견적서 재작성)
 * POST /api/documents/:documentId/redraft
 *
 * 1. 문서 상태를 in_review → draft 로 전환
 * 2. 프로젝트 상태를 B2_estimate_review → B1_estimate_draft 로 전환
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase';

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
    // 담당자(프로젝트 소유자)만 재작성 가능
    const existingDoc = await auth.services.documentRepo.findById(documentId);
    if (!existingDoc) {
      return NextResponse.json(
        { error: { code: 'DOCUMENT_NOT_FOUND', message: '문서를 찾을 수 없습니다' } },
        { status: 404 },
      );
    }
    const ownerProject = await auth.services.projectRepo.findById(existingDoc.project_id);
    if (ownerProject && ownerProject.owner_id && ownerProject.owner_id !== ctx.userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: '담당자만 견적서를 재작성할 수 있습니다' } },
        { status: 403 },
      );
    }

    // 0) 대기 중인 승인 요청이 있으면 취소
    const pendingApproval = await auth.services.approvalRepo.findPendingByDocumentId(documentId);
    if (pendingApproval) {
      await auth.services.approvalRepo.update(pendingApproval.id, {
        approver_id: ctx.userId,
        action: 'cancel',
        actioned_at: new Date().toISOString(),
        comment: '견적서 재작성으로 인한 자동 취소',
      });
    }

    // 1) 문서 상태를 in_review → draft 로 전환
    const docResult = await auth.services.documentService.transitionDocumentStatus(
      documentId,
      'draft',
      ctx,
      '견적서 재작성',
    );

    if (!docResult.success) {
      console.error('[redraft] Document transition failed:', docResult.error);
      return NextResponse.json({ error: docResult.error }, { status: 400 });
    }

    // 1-1) 기존 PDF 삭제 (Storage + metadata)
    const pdfPath = (existingDoc.metadata as Record<string, unknown>)?.pdf_path as string | undefined;
    if (pdfPath) {
      try {
        const serviceClient = createSupabaseServiceClient();
        await serviceClient.storage.from('project-documents').remove([pdfPath]);
      } catch (e) {
        console.warn('[redraft] PDF 삭제 실패 (무시):', e);
      }
      const meta = { ...(existingDoc.metadata as Record<string, unknown>) };
      delete meta.pdf_path;
      await auth.services.documentRepo.update(documentId, { metadata: meta });
    }

    // 2) 프로젝트 상태를 B1_estimate_draft 로 전환 (이미 해당 상태면 건너뜀)
    const projectId = docResult.data!.project_id;
    const project = await auth.services.projectRepo.findById(projectId);

    if (project && project.status === 'B2_estimate_review') {
      const projectResult = await auth.services.projectService.transitionStatus(
        { project_id: projectId, to_status: 'B1_estimate_draft', reason: '견적서 재작성' },
        ctx,
      );

      if (!projectResult.success) {
        console.error('[redraft] Project transition failed:', projectResult.error);
        return NextResponse.json({ error: projectResult.error }, { status: 400 });
      }
    }

    return NextResponse.json({ document: docResult.data });
  } catch (err) {
    console.error('[redraft] Unhandled error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      { status: 500 },
    );
  }
}
