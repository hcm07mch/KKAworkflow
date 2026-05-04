/**
 * API Route: Single Approval Policy
 * PUT    /api/settings/approval-policies/:id  → 정책 수정
 * DELETE /api/settings/approval-policies/:id  → 정책 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole, requireRootOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';
import { createServices } from '@/lib/service-factory';

/** 본사 계정은 하위 지사 정책까지 관리 가능. 지사 계정은 자기 조직만. */
function policyAllowedOrgIds(
  auth: Extract<Awaited<ReturnType<typeof getAuthContext>>, { success: true }>,
): string[] {
  return auth.isRootOrg ? auth.fullAllowedOrgIds : auth.allowedOrgIds;
}

/** 정책 id가 caller가 관리할 수 있는 조직 범위에 속하는지 확인 */
async function assertPolicyInScope(
  auth: Extract<Awaited<ReturnType<typeof getAuthContext>>, { success: true }>,
  policyId: string,
): Promise<NextResponse | null> {
  const existing = await auth.services.approvalPolicyRepo.findByIdWithSteps(policyId);
  if (!existing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '정책을 찾을 수 없습니다' } },
      { status: 404 },
    );
  }
  if (!policyAllowedOrgIds(auth).includes(existing.organization_id)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '해당 조직의 정책을 수정할 권한이 없습니다' } },
      { status: 403 },
    );
  }
  return null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const rootErr = requireRootOrg(auth);
  if (rootErr) return rootErr;

  const roleCheck = requireRole(auth.role, 'admin');
  if (roleCheck) return roleCheck;

  const { id } = await params;
  const scopeErr = await assertPolicyInScope(auth, id);
  if (scopeErr) return scopeErr;

  const body = await request.json();

  // 본사 계정이 지사 정책을 수정할 때 RLS 에 막히지 않도록 service role 클라이언트를 사용
  // (조직 범위는 assertPolicyInScope 에서 이미 보장된다)
  const serviceClient = createSupabaseServiceClient();
  const existing = await auth.services.approvalPolicyRepo.findByIdWithSteps(id);
  const serviceRoleServices = createServices(serviceClient, { organizationId: existing!.organization_id });

  try {
    // 기존 정책의 steps를 삭제하고 새로 삽입하는 방식
    const updated = await serviceRoleServices.approvalPolicyRepo.update(id, {
      required_steps: body.required_steps,
      description: body.description,
      is_active: body.is_active,
    });

    // steps를 교체해야 할 경우 — 기존 steps 삭제 후 재생성
    if (body.steps && Array.isArray(body.steps)) {
      // 기존 steps 삭제 (CASCADE 아닌 수동 처리)
      const { error: deleteError } = await serviceClient
        .from('workflow_approval_policy_steps')
        .delete()
        .eq('policy_id', id);

      if (deleteError) {
        console.error('[approval-policies] Steps delete error:', deleteError);
        throw new Error(`기존 단계 삭제 실패: ${deleteError.message}`);
      }

      // 새 steps 삽입
      if (body.steps.length > 0) {
        const { error: insertError } = await serviceClient
          .from('workflow_approval_policy_steps')
          .insert(
            body.steps.map((s: { step: number; required_role: string; label?: string; assigned_user_id?: string }) => ({
              policy_id: id,
              step: s.step,
              required_role: s.required_role,
              label: s.label ?? null,
              assigned_user_id: s.assigned_user_id ?? null,
            })),
          );

        if (insertError) {
          console.error('[approval-policies] Steps insert error:', insertError);
          throw new Error(`단계 저장 실패: ${insertError.message}`);
        }
      }

      // 최종 결과 재조회
      const final = await serviceRoleServices.approvalPolicyRepo.findByIdWithSteps(id);
      return NextResponse.json(final);
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[approval-policies] Update error:', err);
    return NextResponse.json(
      { error: { code: 'UPDATE_FAILED', message: err instanceof Error ? err.message : 'Unknown error' } },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const rootErr = requireRootOrg(auth);
  if (rootErr) return rootErr;

  const roleCheck = requireRole(auth.role, 'admin');
  if (roleCheck) return roleCheck;

  const { id } = await params;
  const scopeErr = await assertPolicyInScope(auth, id);
  if (scopeErr) return scopeErr;

  try {
    const serviceClient = createSupabaseServiceClient();
    const existing2 = await auth.services.approvalPolicyRepo.findByIdWithSteps(id);
    const svcDelete = createServices(serviceClient, { organizationId: existing2!.organization_id });
    await svcDelete.approvalPolicyRepo.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[approval-policies] Delete error:', err);
    return NextResponse.json(
      { error: { code: 'DELETE_FAILED', message: err instanceof Error ? err.message : 'Unknown error' } },
      { status: 500 },
    );
  }
}
