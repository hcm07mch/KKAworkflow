/**
 * API Route: Document Submit (문서 제출 — 견적서 / 사전보고서 공용)
 * POST /api/documents/:documentId/submit
 *
 * 1. 문서 상태를 in_review로 전환
 * 2. 문서 유형에 따라 프로젝트 상태를 전환
 *    - estimate   → B2_estimate_review
 *    - pre_report → E2_prereport_review
 * 3. 견적서의 경우 PDF를 생성하여 Storage에 저장
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyDocumentInOrg } from '@/lib/auth';
import { generatePdf } from '@/lib/pdf/generate-pdf';
import type { ProjectStatus } from '@/lib/domain/types';

export const maxDuration = 60;

/** 문서 유형 → 프로젝트 전환 상태 매핑 */
const DOC_SUBMIT_STATUS_MAP: Record<string, { toStatus: ProjectStatus; reason: string; label: string }> = {
  estimate:   { toStatus: 'B2_estimate_review',   reason: '견적서 제출',       label: '견적서' },
  pre_report: { toStatus: 'E2_prereport_review',  reason: '사전 보고서 제출',  label: '진행안' },
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

  // origin과 cookie를 추출 (PDF 생성 시 필요)
  const origin = _request.nextUrl.origin;
  const cookieHeader = _request.headers.get('cookie') ?? '';
  const ctx = {
    userId: auth.dbUser.id,
    userRole: auth.role,
    organizationId: auth.organizationId,
  };

  try {
  // 1) 승인 요청 생성 (문서 draft → in_review 자동 전환 포함)
  //    이미 in_review면 건너뜀
  const existingDoc = await auth.services.documentRepo.findById(documentId);
  if (!existingDoc) {
    return NextResponse.json(
      { error: { code: 'DOCUMENT_NOT_FOUND', message: '문서를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }

  // 문서 유형에 따른 전환 정보 조회
  const flowInfo = DOC_SUBMIT_STATUS_MAP[existingDoc.type];
  if (!flowInfo) {
    return NextResponse.json(
      { error: { code: 'UNSUPPORTED_TYPE', message: `이 문서 유형(${existingDoc.type})은 제출을 지원하지 않습니다` } },
      { status: 400 },
    );
  }

  // 담당자(프로젝트 소유자)만 제출 가능
  const ownerProject = await auth.services.projectRepo.findById(existingDoc.project_id);
  if (ownerProject && ownerProject.owner_id && ownerProject.owner_id !== ctx.userId) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: `담당자만 ${flowInfo.label}을(를) 제출할 수 있습니다` } },
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
      console.error('[submit] Approval request failed:', approvalResult.error);
      return NextResponse.json({ error: approvalResult.error }, { status: 400 });
    }

    // 문서를 다시 조회 (in_review 상태 반영)
    finalDoc = (await auth.services.documentRepo.findById(documentId)) ?? existingDoc;
  }

  // 3) 프로젝트 상태 전환 (이미 해당 상태면 건너뜀)
  const projectId = finalDoc.project_id;
  const project = await auth.services.projectRepo.findById(projectId);

  if (project && project.status !== flowInfo.toStatus) {
    const projectResult = await auth.services.projectService.transitionStatus(
      { project_id: projectId, to_status: flowInfo.toStatus, reason: flowInfo.reason },
      ctx,
      { systemInitiated: true },
    );

    if (!projectResult.success) {
      console.error('[submit] Project transition failed:', projectResult.error);
      return NextResponse.json({ error: projectResult.error }, { status: 400 });
    }
  }

  // 4) 견적서인 경우 PDF 생성 (제출 시 자동 생성)
  if (existingDoc.type === 'estimate') {
    const latestDoc = (await auth.services.documentRepo.findById(documentId)) ?? finalDoc;
    const pdfResult = await generatePdf(
      {
        documentId,
        organizationId: auth.organizationId,
        origin,
        cookieHeader,
        existingMetadata: (latestDoc.metadata as Record<string, unknown>) ?? {},
      },
      auth.services.documentRepo,
    );
    if (!pdfResult.success) {
      console.warn('[submit] PDF generation failed (non-blocking):', pdfResult.message);
    }
  }

  return NextResponse.json({
    document: finalDoc,
    project: project,
  });
  } catch (err) {
    console.error('[submit] Unhandled error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      { status: 500 },
    );
  }
}
