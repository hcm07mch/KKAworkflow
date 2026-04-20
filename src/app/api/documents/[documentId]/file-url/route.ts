/**
 * API Route: Document File URL
 * GET /api/documents/:documentId/file-url
 *
 * Supabase Storage에서 서명된 URL을 반환
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

  const doc = await auth.services.documentRepo.findById(documentId);
  if (!doc) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '문서를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }

  const content = doc.content as Record<string, unknown>;
  const filePath = content?.file_path as string | undefined;

  if (!filePath) {
    return NextResponse.json(
      { error: { code: 'NO_FILE', message: '파일이 없습니다' } },
      { status: 404 },
    );
  }

  const serviceClient = createSupabaseServiceClient();
  const { data, error } = await serviceClient.storage
    .from('project-documents')
    .createSignedUrl(filePath, 3600); // 1시간 유효

  if (error || !data?.signedUrl) {
    console.error('[file-url] Signed URL error:', error);
    return NextResponse.json(
      { error: { code: 'URL_ERROR', message: '파일 URL 생성에 실패했습니다' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
