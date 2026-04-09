/**
 * API Route: Document Approval Progress
 * GET /api/documents/:documentId/approvals/progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { documentId } = await params;

  const progress = await auth.services.approvalService.getApprovalProgress(
    documentId,
    auth.organizationId,
  );

  return NextResponse.json(progress);
}
