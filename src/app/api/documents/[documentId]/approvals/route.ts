/**
 * API Route: Document Approvals
 * GET  /api/documents/:documentId/approvals  ? ?뱀??대?議고
 * POST /api/documents/:documentId/approvals  ? ?뱀??泥
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { documentId } = await params;
  const history = await auth.services.approvalService.getApprovalHistory(documentId);

  return NextResponse.json(history);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { documentId } = await params;
  const body = await request.json().catch(() => ({}));

  const result = await auth.services.approvalService.requestDocumentApproval(
    { document_id: documentId, comment: body.comment },
    { userId: auth.dbUser.id, userRole: auth.role, organizationId: auth.organizationId },
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.data, { status: 201 });
}
