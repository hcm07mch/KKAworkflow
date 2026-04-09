/**
 * API Route: Process Approval
 * POST /api/approvals/:approvalId  ? ?뱀?諛??痍⑥ 泥由?
 *
 * Body: { "action": "approve" | "reject" | "cancel", "comment"?: "..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ approvalId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { approvalId } = await params;
  const { action, comment } = await request.json();
  const ctx = { userId: auth.dbUser.id, userRole: auth.role, organizationId: auth.organizationId };

  let result;

  switch (action) {
    case 'approve': {
      const roleCheck = requireRole(auth.role, 'manager');
      if (roleCheck) return roleCheck;
      result = await auth.services.approvalService.approveDocument({ approval_id: approvalId, comment }, ctx);
      break;
    }
    case 'reject': {
      const roleCheck = requireRole(auth.role, 'manager');
      if (roleCheck) return roleCheck;
      result = await auth.services.approvalService.rejectDocument({ approval_id: approvalId, comment }, ctx);
      break;
    }
    case 'cancel':
      result = await auth.services.approvalService.cancelApprovalRequest({ approval_id: approvalId, comment }, ctx);
      break;
    case 'revert': {
      const roleCheck = requireRole(auth.role, 'manager');
      if (roleCheck) return roleCheck;
      result = await auth.services.approvalService.revertApproval({ approval_id: approvalId, comment }, ctx);
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
