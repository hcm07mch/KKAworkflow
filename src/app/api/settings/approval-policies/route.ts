/**
 * API Route: Approval Policies CRUD
 * GET  /api/settings/approval-policies       → 조직 승인 정책 목록
 * POST /api/settings/approval-policies       → 승인 정책 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole, requireRootOrg } from '@/lib/auth';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const policies = await auth.services.approvalPolicyRepo.findByOrganizationId(
    auth.organizationId,
  );

  return NextResponse.json(policies);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const rootErr = requireRootOrg(auth);
  if (rootErr) return rootErr;

  const roleCheck = requireRole(auth.role, 'admin');
  if (roleCheck) return roleCheck;

  const body = await request.json();

  try {
    const policy = await auth.services.approvalPolicyRepo.create({
      organization_id: auth.organizationId,
      document_type: body.document_type ?? null,
      required_steps: body.required_steps,
      description: body.description ?? null,
      is_active: body.is_active ?? true,
      steps: body.steps ?? [],
    });

    return NextResponse.json(policy, { status: 201 });
  } catch (err) {
    console.error('[approval-policies] Create error:', err);
    return NextResponse.json(
      { error: { code: 'CREATE_FAILED', message: err instanceof Error ? err.message : 'Unknown error' } },
      { status: 500 },
    );
  }
}
