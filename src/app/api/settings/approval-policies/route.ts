/**
 * API Route: Approval Policies CRUD
 * GET  /api/settings/approval-policies?organization_id=<id> → 조직 승인 정책 목록
 * POST /api/settings/approval-policies                      → 승인 정책 생성
 *
 * 본사(루트) 계정은 query/body의 organization_id를 통해 자기 조직 및 하위 지사의 정책을 관리할 수 있다.
 * organization_id가 생략되면 현재 스코프(auth.organizationId)를 사용한다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole, requireRootOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';
import { createServices } from '@/lib/service-factory';

/**
 * 승인 정책을 관리할 수 있는 조직 ID 범위:
 *  - 본사(루트) 계정: 본사 + 모든 하위 지사
 *  - 지사 계정: 자기 조직만
 */
function policyAllowedOrgIds(
  auth: Extract<Awaited<ReturnType<typeof getAuthContext>>, { success: true }>,
): string[] {
  return auth.isRootOrg ? auth.fullAllowedOrgIds : auth.allowedOrgIds;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const url = new URL(request.url);
  const orgIdParam = url.searchParams.get('organization_id');
  const allowed = policyAllowedOrgIds(auth);

  const targetOrgId = orgIdParam ?? auth.organizationId;
  if (!allowed.includes(targetOrgId)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '해당 조직의 승인 정책을 조회할 권한이 없습니다' } },
      { status: 403 },
    );
  }

  const policies = await auth.services.approvalPolicyRepo.findByOrganizationId(targetOrgId);

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
  const allowed = policyAllowedOrgIds(auth);

  const targetOrgId: string = body.organization_id ?? auth.organizationId;
  if (!allowed.includes(targetOrgId)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '해당 조직에 승인 정책을 생성할 권한이 없습니다' } },
      { status: 403 },
    );
  }

  try {
    // 본사 계정이 지사 정책을 생성할 때 RLS(organization_id 일치 검사)가 차단하므로
    // service role 클라이언트로 RLS 를 우회한다. 조직 범위는 위의 allowed 검사로 이미 보장된다.
    const serviceClient = createSupabaseServiceClient();
    const serviceRoleServices = createServices(serviceClient, { organizationId: targetOrgId });
    const policy = await serviceRoleServices.approvalPolicyRepo.create({
      organization_id: targetOrgId,
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
