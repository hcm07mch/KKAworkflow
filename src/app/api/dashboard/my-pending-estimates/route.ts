/**
 * API Route: My Pending Estimates
 * GET /api/dashboard/my-pending-estimates
 *   - 현재 로그인한 사용자가 "지금 당장" 승인/반려할 수 있는 견적서 목록
 *   - 활성 스코프(allowedOrgIds) 안의 in_review 상태 견적 중,
 *     해당 단계의 required_role / assigned_user_id 조건을 모두 만족하는 건만 반환
 */

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';
import { SupabaseApprovalPolicyRepository } from '@/lib/infrastructure/supabase/repositories/approval-policy.repository';
import type { UserRole } from '@/lib/domain/types';

const ROLE_LEVELS: Record<UserRole, number> = {
  admin: 100,
  manager: 50,
  member: 10,
};

export async function GET() {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const supabase = createSupabaseServiceClient();
  const { allowedOrgIds, dbUser, role } = auth;

  // 1) 활성 스코프 안의 in_review 견적서 목록 조회
  const { data: docsRaw, error: docsErr } = await supabase
    .from('workflow_project_documents')
    .select(`
      id, content,
      project:workflow_projects!inner(
        id, title, organization_id, total_amount,
        client:workflow_clients(name),
        owner:workflow_users!workflow_projects_owner_id_fkey(name)
      )
    `)
    .eq('type', 'estimate')
    .eq('status', 'in_review')
    .in('project.organization_id', allowedOrgIds);

  if (docsErr) {
    return NextResponse.json(
      { error: { code: 'QUERY_FAILED', message: docsErr.message } },
      { status: 500 },
    );
  }

  const docs = (docsRaw ?? []) as any[];
  // !inner 결과에서 project 가 비어있는 케이스 제외
  const validDocs = docs.filter((d) => d.project?.organization_id);
  if (validDocs.length === 0) {
    return NextResponse.json({ items: [], count: 0 });
  }

  const docById = new Map<string, any>(validDocs.map((d) => [d.id as string, d]));
  const documentIds = Array.from(docById.keys());

  // 2) 해당 견적서들에 대한 미처리 승인 요청 조회
  const { data: approvalsRaw, error: apErr } = await supabase
    .from('workflow_document_approvals')
    .select('id, document_id, step, requested_at, metadata')
    .in('document_id', documentIds)
    .is('action', null)
    .order('requested_at', { ascending: true });

  if (apErr) {
    return NextResponse.json(
      { error: { code: 'QUERY_FAILED', message: apErr.message } },
      { status: 500 },
    );
  }

  const approvals = (approvalsRaw ?? []) as any[];
  if (approvals.length === 0) {
    return NextResponse.json({ items: [], count: 0 });
  }

  // 3) 조직별 견적 정책 1회씩 조회 (지사 → 본사 fallback 포함)
  const policyRepo = new SupabaseApprovalPolicyRepository(supabase as any);
  const uniqueOrgIds = Array.from(
    new Set(
      approvals
        .map((a) => docById.get(a.document_id)?.project?.organization_id as string | undefined)
        .filter((x): x is string => !!x),
    ),
  );
  const policyEntries = await Promise.all(
    uniqueOrgIds.map(async (orgId) => {
      const policy = await policyRepo.findByOrgAndTypeWithRootFallback(orgId, 'estimate');
      return [orgId, policy] as const;
    }),
  );
  const policyByOrg = new Map(policyEntries);

  // 4) 각 승인 요청에 대해 step 정책 매칭 → 사용자 권한 검증
  const items = approvals
    .map((a) => {
      const doc = docById.get(a.document_id);
      if (!doc) return null;
      const orgId = doc.project.organization_id as string;
      const policy = policyByOrg.get(orgId);
      const stepConfig = policy?.steps?.find((s) => s.step === a.step);
      // 정책 없으면 기본값 (manager, 지정자 없음) — approval.service 의 getPolicy 와 동일
      const requiredRole = (stepConfig?.required_role ?? 'manager') as UserRole;
      const assignedUserId = stepConfig?.assigned_user_id ?? null;

      // 권한 검증: 역할 레벨 + 지정 담당자
      if (ROLE_LEVELS[role] < ROLE_LEVELS[requiredRole]) return null;
      if (assignedUserId && assignedUserId !== dbUser.id) return null;

      const content = (doc.content ?? {}) as Record<string, unknown>;
      const amount =
        (content?.total as number | undefined) ??
        (content?.subtotal as number | undefined) ??
        (doc.project.total_amount as number | undefined) ??
        0;

      return {
        approvalId: a.id as string,
        documentId: doc.id as string,
        projectId: doc.project.id as string,
        projectTitle: (doc.project.title as string) ?? '',
        clientName: (doc.project.client?.name as string) ?? '',
        ownerName: (doc.project.owner?.name as string) ?? null,
        step: a.step as number,
        stepLabel: (stepConfig?.label as string | null | undefined) ?? null,
        requestedAt: a.requested_at as string,
        amount,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json({ items, count: items.length });
}
