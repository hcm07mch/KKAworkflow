/**
 * API Route: Single Approval Policy
 * PUT    /api/settings/approval-policies/:id  → 정책 수정
 * DELETE /api/settings/approval-policies/:id  → 정책 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const roleCheck = requireRole(auth.role, 'admin');
  if (roleCheck) return roleCheck;

  const { id } = await params;
  const body = await request.json();

  try {
    // 기존 정책의 steps를 삭제하고 새로 삽입하는 방식
    const updated = await auth.services.approvalPolicyRepo.update(id, {
      required_steps: body.required_steps,
      description: body.description,
      is_active: body.is_active,
    });

    // steps를 교체해야 할 경우 — 기존 steps 삭제 후 재생성
    if (body.steps && Array.isArray(body.steps)) {
      // 기존 steps 삭제 (CASCADE 아닌 수동 처리)
      const { error: deleteError } = await auth.supabase
        .from('workflow_approval_policy_steps')
        .delete()
        .eq('policy_id', id);

      if (deleteError) {
        console.error('[approval-policies] Steps delete error:', deleteError);
        throw new Error(`기존 단계 삭제 실패: ${deleteError.message}`);
      }

      // 새 steps 삽입
      if (body.steps.length > 0) {
        const { error: insertError } = await auth.supabase
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
      const final = await auth.services.approvalPolicyRepo.findByIdWithSteps(id);
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

  const roleCheck = requireRole(auth.role, 'admin');
  if (roleCheck) return roleCheck;

  const { id } = await params;

  try {
    await auth.services.approvalPolicyRepo.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[approval-policies] Delete error:', err);
    return NextResponse.json(
      { error: { code: 'DELETE_FAILED', message: err instanceof Error ? err.message : 'Unknown error' } },
      { status: 500 },
    );
  }
}
