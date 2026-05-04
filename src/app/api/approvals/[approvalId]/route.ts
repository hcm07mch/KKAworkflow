/**
 * API Route: Process Approval
 * POST /api/approvals/:approvalId  ? ?뱀?諛??痍⑥ 泥由?
 *
 * Body: { "action": "approve" | "reject" | "cancel", "comment"?: "..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';
import { createServices } from '@/lib/service-factory';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ approvalId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { approvalId } = await params;
  const { action, comment } = await request.json();

  // 본사 계정이 지사 스코프에서 승인 처리할 때 RLS 를 우회하기 위해 service client 기반 서비스 사용
  const serviceClient = createSupabaseServiceClient();

  // 본사(루트) 계정이 승인/반려를 처리할 때, 문서가 지사 소속이면
  // ctx.organizationId 를 해당 지사 org ID 로 교체한다.
  // 이렇게 해야 verifyDocumentOrgScope 가 통과하고,
  // getPolicy() 가 HQ 정책 대신 지사 정책을 올바르게 조회한다.
  let ctxOrgId = auth.organizationId;
  if (auth.isRootOrg && (action === 'approve' || action === 'reject')) {
    const { data: approvalRec } = await serviceClient
      .from('workflow_document_approvals')
      .select('document_id')
      .eq('id', approvalId)
      .maybeSingle();
    if (approvalRec?.document_id) {
      const { data: docRec } = await serviceClient
        .from('workflow_project_documents')
        .select('project:workflow_projects!inner(organization_id)')
        .eq('id', approvalRec.document_id)
        .maybeSingle();
      const projectOrg = (docRec?.project as { organization_id: string } | null)?.organization_id;
      if (projectOrg && auth.fullAllowedOrgIds.includes(projectOrg)) {
        ctxOrgId = projectOrg;
      }
    }
  }

  const ctx = { userId: auth.dbUser.id, userRole: auth.role, organizationId: ctxOrgId };
  const services = createServices(serviceClient, { organizationId: ctxOrgId });

  let result;

  switch (action) {
    case 'approve': {
      const roleCheck = requireRole(auth.role, 'manager');
      if (roleCheck) return roleCheck;
      result = await services.approvalService.approveDocument({ approval_id: approvalId, comment }, ctx);
      break;
    }
    case 'reject': {
      const roleCheck = requireRole(auth.role, 'manager');
      if (roleCheck) return roleCheck;
      result = await services.approvalService.rejectDocument({ approval_id: approvalId, comment }, ctx);
      break;
    }
    case 'cancel':
      result = await services.approvalService.cancelApprovalRequest({ approval_id: approvalId, comment }, ctx);
      break;
    case 'revert': {
      const roleCheck = requireRole(auth.role, 'manager');
      if (roleCheck) return roleCheck;
      result = await services.approvalService.revertApproval({ approval_id: approvalId, comment }, ctx);
      break;
    }
    default:
      return NextResponse.json(
        { error: { code: 'INVALID_ACTION', message: 'action? approve, reject, cancel 以 ???ъ??⑸??' } },
        { status: 400 },
      );
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.data);
}
