/**
 * API Route: Document Send
 * POST /api/documents/:documentId/send  ? 臾몄 ?몃? 諛??
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyDocumentInOrg } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { documentId } = await params;
  const body = await request.json().catch(() => ({}));

  const orgError = await verifyDocumentInOrg(auth, documentId);
  if (orgError) return orgError;

  const result = await auth.services.documentService.sendDocumentToClient(
    { document_id: documentId, sent_to: body.sent_to },
    { userId: auth.dbUser.id, userRole: auth.role, organizationId: auth.organizationId },
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.data);
}
