/**
 * API Route: Generate PDF (Server-side)
 * POST /api/documents/:documentId/pdf/generate
 *
 * Puppeteer로 견적서 인쇄 페이지를 렌더링하여 PDF를 생성하고
 * Supabase Storage에 업로드한 뒤 signed URL을 반환합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyDocumentInOrg } from '@/lib/auth';
import { generatePdf } from '@/lib/pdf/generate-pdf';

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
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

  const result = await generatePdf(
    {
      documentId,
      organizationId: auth.organizationId,
      origin: request.nextUrl.origin,
      cookieHeader: request.headers.get('cookie') ?? '',
      existingMetadata: (doc.metadata as Record<string, unknown>) ?? {},
    },
    auth.services.documentRepo,
  );

  if (!result.success) {
    return NextResponse.json(
      { error: { code: result.code, message: result.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: result.url, path: result.path });
}
