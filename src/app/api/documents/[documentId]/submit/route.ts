/**
 * API Route: Document Submit (견적서 제출)
 * POST /api/documents/:documentId/submit
 *
 * 1. PDF 파일을 Supabase Storage에 업로드
 * 2. 문서 상태를 in_review로 전환
 * 3. 프로젝트 상태를 B2_estimate_review(견적 승인)로 전환
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase';

export async function POST(
  request: NextRequest,
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

  // 0) PDF 파일 업로드 (multipart/form-data)
  const formData = await request.formData();
  const pdfFile = formData.get('pdf') as File | null;

  let pdfUrl: string | null = null;

  if (pdfFile) {
    const serviceClient = createSupabaseServiceClient();
    const filePath = `${auth.organizationId}/${documentId}/${pdfFile.name}`;

    const { error: uploadError } = await serviceClient.storage
      .from('project-documents')
      .upload(filePath, pdfFile, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: { code: 'UPLOAD_FAILED', message: uploadError.message } },
        { status: 500 },
      );
    }

    pdfUrl = filePath;
  }

  // 1) PDF 경로를 문서 metadata에 먼저 기록 (draft 상태에서만 수정 가능)
  if (pdfUrl) {
    const existing = await auth.services.documentRepo.findById(documentId);
    if (existing) {
      await auth.services.documentRepo.update(documentId, {
        metadata: { ...((existing.metadata as Record<string, unknown>) ?? {}), pdf_path: pdfUrl },
      });
    }
  }

  // 2) 문서 상태를 draft → in_review 로 전환
  const docResult = await auth.services.documentService.transitionDocumentStatus(
    documentId,
    'in_review',
    ctx,
  );

  if (!docResult.success) {
    return NextResponse.json({ error: docResult.error }, { status: 400 });
  }

  // 3) 프로젝트 상태를 B2_estimate_review (견적 승인)로 전환
  const projectId = docResult.data!.project_id;
  const projectResult = await auth.services.projectService.transitionStatus(
    { project_id: projectId, to_status: 'B2_estimate_review', reason: '견적서 제출' },
    ctx,
  );

  if (!projectResult.success) {
    return NextResponse.json({ error: projectResult.error }, { status: 400 });
  }

  return NextResponse.json({
    document: docResult.data,
    project: projectResult.data,
    pdfUrl,
  });
}
