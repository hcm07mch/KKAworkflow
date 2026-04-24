/**
 * API Route: Document Approvals
 * GET  /api/documents/:documentId/approvals  ? ?뱀??대?議고
 * POST /api/documents/:documentId/approvals  ? ?뱀??泥
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyDocumentInOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';
import { createServices } from '@/lib/service-factory';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { documentId } = await params;

  const orgError = await verifyDocumentInOrg(auth, documentId);
  if (orgError) return orgError;

  // 본사 계정이 지사 스코프로 전환한 경우 RLS(approvals_select_via_document)
  // 가 get_current_user_organization_id() = 본사 기준으로 작동해 지사 문서의
  // 승인 이력을 읽지 못한다. 조직 경계는 verifyDocumentInOrg 로 이미 보장되므로
  // service client 로 우회한다.
  const serviceClient = createSupabaseServiceClient();
  const services = createServices(serviceClient, { organizationId: auth.organizationId });

  const history = await services.approvalService.getApprovalHistory(documentId);

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

  const orgError = await verifyDocumentInOrg(auth, documentId);
  if (orgError) return orgError;

  const serviceClient = createSupabaseServiceClient();
  const services = createServices(serviceClient, { organizationId: auth.organizationId });

  const result = await services.approvalService.requestDocumentApproval(
    { document_id: documentId, comment: body.comment },
    { userId: auth.dbUser.id, userRole: auth.role, organizationId: auth.organizationId },
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.data, { status: 201 });
}
