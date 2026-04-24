/**
 * API Route: Document Approval Progress
 * GET /api/documents/:documentId/approvals/progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyDocumentInOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';
import { createServices } from '@/lib/service-factory';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { documentId } = await params;

  const orgError = await verifyDocumentInOrg(auth, documentId);
  if (orgError) return orgError;

  // 본사 계정이 지사 스코프로 전환한 경우, workflow_users.organization_id(본사) 와
  // auth.organizationId(지사) 가 달라 RLS 의 approval_policies_select 정책에 막혀
  // 지사 승인 정책을 읽지 못한다 → UI 에 "승인 단계 정보 없음" 이 뜬다.
  // 조직 경계는 verifyDocumentInOrg 로 이미 보장되므로 service client 로 우회한다.
  const serviceClient = createSupabaseServiceClient();
  const services = createServices(serviceClient, { organizationId: auth.organizationId });

  const progress = await services.approvalService.getApprovalProgress(
    documentId,
    auth.organizationId,
  );

  return NextResponse.json(progress);
}
