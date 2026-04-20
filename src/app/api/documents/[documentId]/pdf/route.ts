/**
 * API Route: Document PDF Download
 * GET /api/documents/:documentId/pdf → Supabase Storage에서 PDF signed URL 반환
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

  const orgError = await verifyDocumentInOrg(auth, documentId);
  if (orgError) return orgError;

  // 1) 문서 조회 → metadata.pdf_path 확인
  const doc = await auth.services.documentRepo.findById(documentId);
  if (!doc) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '문서를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }

  const pdfPath = (doc.metadata as Record<string, unknown>)?.pdf_path as string | undefined;
  if (!pdfPath) {
    return NextResponse.json(
      { error: { code: 'NO_PDF', message: 'PDF 파일이 없습니다' } },
      { status: 404 },
    );
  }

  // 2) signed URL 생성 (60초 유효)
  const serviceClient = createSupabaseServiceClient();
  const { data, error } = await serviceClient.storage
    .from('project-documents')
    .createSignedUrl(pdfPath, 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: { code: 'STORAGE_ERROR', message: error?.message ?? 'URL 생성 실패' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
