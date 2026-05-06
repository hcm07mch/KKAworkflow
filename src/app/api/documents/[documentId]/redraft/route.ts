/**
 * API Route: Document Re-draft (문서 재작성 — 견적서 / 사전보고서 공용)
 * POST /api/documents/:documentId/redraft
 *
 * 1. 문서 상태를 in_review → draft 로 전환
 * 2. 문서 유형에 따라 프로젝트 상태를 그룹의 draft 단계(B1/E1)로 되돌린다.
 *    현재 상태가 승인 단계(B2/E2) 뿐만 아니라 전달/응답 등 "그룹 내 이후
 *    단계"일 때도 재작성을 지원한다 (allowRewindWithinGroup).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyDocumentInOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase';
import { createServices } from '@/lib/service-factory';
import type { ProjectStatus } from '@/lib/domain/types';

/** 문서 유형 → 재작성 시 프로젝트 되돌림 대상 매핑.
 *  toStatus 는 언제나 해당 그룹의 draft(첫) 단계. */
const DOC_REDRAFT_STATUS_MAP: Record<string, { toStatus: ProjectStatus; reason: string; label: string }> = {
  estimate:   { toStatus: 'B1_estimate_draft',   reason: '견적서 재작성',      label: '견적서' },
  pre_report: { toStatus: 'E1_prereport_draft',  reason: '사전 보고서 재작성', label: '진행안' },
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { documentId } = await params;

  const orgError = await verifyDocumentInOrg(auth, documentId);
  if (orgError) return orgError;

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
        { error: { code: 'FORBIDDEN', message: '담당자만 문서를 재작성할 수 있습니다' } },
        { status: 403 },
      );
    }

    // 문서 유형에 따른 전환 정보 조회
    const flowInfo = DOC_REDRAFT_STATUS_MAP[existingDoc.type];

    // 0) 대기 중인 승인 요청이 있으면 취소
    const pendingApproval = await auth.services.approvalRepo.findPendingByDocumentId(documentId);
    if (pendingApproval) {
      const serviceClient = createSupabaseServiceClient();
      const serviceServices = createServices(serviceClient, { organizationId: auth.organizationId });
      await serviceServices.approvalRepo.update(pendingApproval.id, {
        approver_id: ctx.userId,
        action: 'cancel',
        actioned_at: new Date().toISOString(),
        comment: `${flowInfo?.label ?? '문서'} 재작성으로 인한 자동 취소`,
      });
    }

    // 1) 문서 상태를 in_review → draft 로 전환
    const docResult = await auth.services.documentService.transitionDocumentStatus(
      documentId,
      'draft',
      ctx,
      `${flowInfo?.label ?? '문서'} 재작성`,
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
      await auth.services.documentRepo.update(documentId, { metadata: meta as Record<string, any> });
    }

    // 2) 프로젝트 상태를 draft 단계로 전환.
    //    - 현재 상태가 이미 toStatus 면 건너뜀.
    //    - 그 외 그룹이 다르면 아무것도 돌릴 수 없는 설계 (충돌 방지).
    //    - 그룹이 같고 toStatus보다 하류일 때는 allowRewindWithinGroup 으로 허용.
    const projectId = docResult.data!.project_id;
    const project = await auth.services.projectRepo.findById(projectId);

    if (project && flowInfo) {
      const sameGroup = project.status.charAt(0) === flowInfo.toStatus.charAt(0);
      const isAlreadyAtTarget = project.status === flowInfo.toStatus;
      if (sameGroup && !isAlreadyAtTarget) {
        const projectResult = await auth.services.projectService.transitionStatus(
          { project_id: projectId, to_status: flowInfo.toStatus, reason: flowInfo.reason },
          ctx,
          { systemInitiated: true, allowRewindWithinGroup: true },
        );

        if (!projectResult.success) {
          console.error('[redraft] Project transition failed:', projectResult.error);
          return NextResponse.json({ error: projectResult.error }, { status: 400 });
        }
      } else if (!sameGroup) {
        console.warn('[redraft] Skipping project rewind: project is in a different group',
          { projectStatus: project.status, target: flowInfo.toStatus });
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
