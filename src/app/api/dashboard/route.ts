/**
 * API Route: Dashboard
 * GET /api/dashboard  → 대시보드 집계 데이터
 */

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { supabase, organizationId } = auth;

  // ── 병렬로 필요한 데이터 조회 ──

  const [projectsRes, estimatesRes, statusHistoryRes] = await Promise.all([
    // 1) 전체 프로젝트 (파이프라인 + 미입금 + 집행대기 + 갱신 계산)
    supabase
      .from('workflow_projects')
      .select('id, title, status, total_amount, start_date, client:workflow_clients(name)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),

    // 2) 견적서 문서 상태별 집계
    supabase
      .from('workflow_project_documents')
      .select('id, status, project:workflow_projects!inner(organization_id)')
      .eq('type', 'estimate')
      .eq('project.organization_id', organizationId),

    // 3) D1 진입 이력 (미입금 경과일 계산용)
    supabase
      .from('workflow_project_status_history')
      .select('project_id, to_status, created_at')
      .eq('to_status', 'D1_payment_pending')
      .order('created_at', { ascending: false }),
  ]);

  const projects = projectsRes.data ?? [];
  const estimates = estimatesRes.data ?? [];

  // ── 파이프라인 (F그룹 제외) ──
  const pipeline = projects
    .filter((p: any) => !p.status.startsWith('F'))
    .map((p: any) => ({
      id: p.id,
      client: p.client?.name ?? '',
      title: p.title,
      status: p.status,
    }));

  // ── 견적 승인 현황 ──
  const estApproved = estimates.filter((e: any) => e.status === 'approved').length;
  const estRejected = estimates.filter((e: any) => e.status === 'rejected').length;
  const estPending = estimates.filter((e: any) => e.status === 'in_review' || e.status === 'draft').length;
  const estSent = estimates.filter((e: any) => e.status === 'sent').length;
  const estTotal = estimates.length;
  const estDecided = estApproved + estRejected;
  const approveRate = estDecided > 0 ? Math.round((estApproved / estDecided) * 100) : 0;
  const rejectRate = estDecided > 0 ? 100 - approveRate : 0;

  // ── 미입금 목록 (D1_payment_pending) ──
  const d1History = (statusHistoryRes.data ?? []) as any[];
  const d1DateMap = new Map<string, string>();
  for (const h of d1History) {
    if (!d1DateMap.has(h.project_id)) {
      d1DateMap.set(h.project_id, h.created_at);
    }
  }

  const now = Date.now();
  const unpaidProjects = projects.filter((p: any) => p.status === 'D1_payment_pending');
  const unpaidItems = unpaidProjects
    .map((p: any) => {
      const enteredAt = d1DateMap.get(p.id);
      const daysOverdue = enteredAt
        ? Math.max(0, Math.floor((now - new Date(enteredAt).getTime()) / 86_400_000))
        : 0;
      return {
        client: p.client?.name ?? '',
        project: p.title,
        amount: p.total_amount ?? 0,
        daysOverdue,
      };
    })
    .sort((a: any, b: any) => b.daysOverdue - a.daysOverdue);

  const unpaidTotal = unpaidItems.reduce((s: number, i: any) => s + i.amount, 0);

  // ── 집행 대기 (D2_payment_confirmed – 입금 완료 but 아직 E단계 아님) ──
  const d2Projects = projects.filter((p: any) => p.status === 'D2_payment_confirmed');
  const execQueueItems = d2Projects.map((p: any) => ({
    client: p.client?.name ?? '',
    project: p.title,
    daysWaiting: p.start_date
      ? Math.max(0, Math.floor((now - new Date(p.start_date).getTime()) / 86_400_000))
      : 0,
  }));

  // ── 갱신 (F 프로젝트 기반) ──
  const fProjects = projects.filter((p: any) => p.status.startsWith('F'));
  const renewed = fProjects.filter((p: any) => p.status === 'F2_closed').length;
  const cancelled = fProjects.filter((p: any) => p.status === 'F1_refund').length;
  const fTotal = renewed + cancelled;
  const renewRate = fTotal > 0 ? Math.round((renewed / fTotal) * 100) : 0;

  return NextResponse.json({
    pipeline,
    estimateStats: {
      pending: estPending + estSent,
      approved: estApproved,
      rejected: estRejected,
      total: estTotal,
      approveRate,
      rejectRate,
    },
    unpaid: {
      count: unpaidProjects.length,
      totalAmount: unpaidTotal,
      items: unpaidItems.slice(0, 10),
    },
    executionQueue: {
      count: d2Projects.length,
      items: execQueueItems.slice(0, 5),
    },
    renewal: {
      total: fTotal,
      renewed,
      cancelled,
      pending: 0,
      renewRate,
    },
  });
}
