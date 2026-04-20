/**
 * API Route: Dashboard
 * GET /api/dashboard  → 대시보드 집계 데이터
 */

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { supabase, allowedOrgIds } = auth;

  // ── 병렬로 필요한 데이터 조회 ──

  const [projectsRes, statusHistoryRes] = await Promise.all([
    // 1) 전체 프로젝트 (파이프라인 + 미입금 + 집행대기 + 갱신 계산)
    supabase
      .from('workflow_projects')
      .select('id, title, status, total_amount, start_date, metadata, client:workflow_clients(name), owner:workflow_users!workflow_projects_owner_id_fkey(name)')
      .in('organization_id', allowedOrgIds)
      .order('created_at', { ascending: false }),

    // 2) D1 진입 이력 (미입금 경과일 계산용)
    supabase
      .from('workflow_project_status_history')
      .select('project_id, to_status, created_at')
      .eq('to_status', 'D1_payment_pending')
      .order('created_at', { ascending: false }),
  ]);

  const projects = projectsRes.data ?? [];

  // ── 파이프라인 (F그룹 제외) ──
  const pipeline = projects
    .filter((p: any) => !p.status.startsWith('F') && !p.status.startsWith('G'))
    .map((p: any) => ({
      id: p.id,
      client: p.client?.name ?? '',
      title: p.title,
      status: p.status,
      owner: p.owner?.name ?? null,
    }));

  // ── 견적 승인 현황 (workflow_stack 기반) ──
  // B그룹(견적) 플로우가 스택에 존재하는 프로젝트 = 견적 진행
  // → D그룹(입금) 도달 = 승인 / F1·G1 종료 = 거절

  // 상태 이력에서 D1 진입 날짜 (미입금 경과일용)
  const statusHistory = (statusHistoryRes.data ?? []) as any[];
  const d1DateMap = new Map<string, string>();
  for (const h of statusHistory) {
    if (h.to_status === 'D1_payment_pending' && !d1DateMap.has(h.project_id)) {
      d1DateMap.set(h.project_id, h.created_at);
    }
  }

  let estApproved = 0;
  let estRejected = 0;
  let estPending = 0;

  for (const p of projects) {
    const stack: string[] = ((p as any).metadata as any)?.workflow_stack ?? [];
    const status = (p as any).status as string;

    // 스택을 순회하며 B→D 사이클 카운트
    // B 세그먼트가 나오면 견적 1건, 이후 D가 나오면 승인, 다음 B 전에 D 없으면 미승인
    let inB = false;
    let bCount = 0; // 총 견적 플로우 수
    let dAfterB = 0; // B 이후 D 도달 수

    for (const s of stack) {
      const key = s.charAt(0);
      if (key === 'B') {
        if (!inB) {
          bCount++;
          inB = true;
        }
      } else {
        if (key === 'D' && inB) {
          dAfterB++;
        }
        inB = false;
      }
    }

    if (bCount === 0) continue; // 견적 플로우가 없는 프로젝트는 제외

    estApproved += dAfterB;

    // 마지막 B 세그먼트 이후 D가 없는 경우
    const unresolvedB = bCount - dAfterB;
    if (unresolvedB > 0) {
      if (status === 'F1_refund' || status === 'G1_closed') {
        estRejected += unresolvedB;
      } else {
        estPending += unresolvedB;
      }
    }
  }

  const estTotal = estApproved + estRejected + estPending;
  const estDecided = estApproved + estRejected;
  const approveRate = estDecided > 0 ? Math.round((estApproved / estDecided) * 100) : 0;
  const rejectRate = estDecided > 0 ? 100 - approveRate : 0;

  // ── 미입금 목록 (D1_payment_pending) ──

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

  // ── 계약 갱신/해지 (workflow_stack 기반) ──
  // C 세그먼트(계약 플로우) 이후 추가 C 세그먼트 → 갱신
  // C 세그먼트 이후 G 세그먼트(종료 플로우) → 해지
  let totalRenewed = 0;
  let totalCancelled = 0;
  let totalRenewPending = 0;

  for (const p of projects) {
    const stack: string[] = ((p as any).metadata as any)?.workflow_stack ?? [];
    const status = (p as any).status as string;

    let inC = false;
    let cCount = 0;

    for (const s of stack) {
      const key = s.charAt(0);
      if (key === 'C') {
        if (!inC) { cCount++; inC = true; }
      } else {
        inC = false;
      }
    }

    if (cCount === 0) continue;

    // 마지막 C를 제외한 모든 C 세그먼트 = 갱신 (이후 다시 C 진입)
    totalRenewed += (cCount - 1);

    // 마지막 C 세그먼트: G 진입 여부로 해지/진행중 판별
    let gAfterLastC = false;
    let lastCIdx = -1;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].charAt(0) === 'C') { lastCIdx = i; break; }
    }
    if (lastCIdx >= 0) {
      for (let i = lastCIdx + 1; i < stack.length; i++) {
        if (stack[i].charAt(0) === 'G') { gAfterLastC = true; break; }
      }
    }

    if (gAfterLastC || status.startsWith('G')) {
      totalCancelled++;
    } else {
      totalRenewPending++;
    }
  }

  const renewDecided = totalRenewed + totalCancelled;
  const renewRate = renewDecided > 0 ? Math.round((totalRenewed / renewDecided) * 100) : 0;

  return NextResponse.json({
    pipeline,
    estimateStats: {
      pending: estPending,
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
      total: renewDecided,
      renewed: totalRenewed,
      cancelled: totalCancelled,
      pending: totalRenewPending,
      renewRate,
    },
  });
}
