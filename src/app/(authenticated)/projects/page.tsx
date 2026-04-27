'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

import { LuFolderOpen, LuPanelLeftOpen, LuPanelLeftClose, LuDownload, LuPencil, LuX, LuCheck, LuExternalLink, LuChevronDown, LuChevronUp, LuRefreshCw, LuTrash2, LuBan } from 'react-icons/lu';
import { StatusBadge, ActionButton, useFeedback } from '@/components/ui';
import { useProjectAssignees } from '@/components/hooks/use-project-assignees';
import type { ProjectStatus, ServiceType, PaymentType, DocumentStatus, DocumentType } from '@/lib/domain/types';
import {
  PROJECT_STATUS_META, PROJECT_STATUS_GROUPS, PROJECT_STATUS_TRANSITIONS,
  SERVICE_TYPE_META, SERVICE_TYPES, PAYMENT_TYPE_META, PAYMENT_TYPES,
  DOCUMENT_TYPE_META, DOCUMENT_STATUS_META,
} from '@/lib/domain/types';
import { WorkflowProgress, WorkflowBuilder } from './[id]/components';
import panel from '../panel-layout.module.css';

/** metadata.workflow_stack이 없을 때 현재 status에서 스택 추론 */
/** 상태 문자열에서 그룹 키 추출 (예: 'B3_estimate_sent' → 'B') */
function statusToGroupKey(status: string): string {
  // H1_closed → 'H', G1_refund → 'G', B3_estimate_sent → 'B', etc.
  return status.charAt(0);
}

/** 레거시/불완전한 스택을 정규화: 모든 세부 상태를 개별 엔트리로 확장 */
function normalizeStack(stack: string[], currentStatus: ProjectStatus): string[] {
  // Step 1: 레거시 그룹 키 → 상태 코드로 변환 (한 엔트리 → 여러 엔트리 가능)
  const expanded: string[] = [];
  for (const entry of stack) {
    if (entry.includes('_')) {
      expanded.push(entry);
    } else {
      // 레거시 그룹 키 → 그룹의 마지막 상태 추가
      const group = PROJECT_STATUS_GROUPS.find((g) => g.key === entry);
      if (group) expanded.push(group.statuses[group.statuses.length - 1]);
      else expanded.push(entry);
    }
  }

  // Step 2: 각 그룹 세그먼트에서 선행 상태 보충
  //   — 동일 그룹 연속 엔트리의 인덱스가 역행(예: B3 → B1)하면 새 세그먼트로 분리.
  const result: string[] = [];
  let i = 0;
  while (i < expanded.length) {
    const key = statusToGroupKey(expanded[i]);
    const group = PROJECT_STATUS_GROUPS.find((g) => g.key === key);
    if (!group) { result.push(expanded[i]); i++; continue; }

    // 하나의 세그먼트: 인덱스 역행 지점에서 종료
    let maxIdx = -1;
    let prevIdx = -1;
    while (i < expanded.length && statusToGroupKey(expanded[i]) === key) {
      const idx = group.statuses.indexOf(expanded[i] as ProjectStatus);
      if (idx < prevIdx) break;
      if (idx > maxIdx) maxIdx = idx;
      prevIdx = idx;
      i++;
    }

    // 0부터 maxIdx까지 모든 세부 상태 채워넣기
    for (let j = 0; j <= maxIdx; j++) {
      result.push(group.statuses[j]);
    }
  }

  // Step 3: 마지막 세그먼트가 현재 상태까지 도달하지 못했으면 보충
  if (result.length > 0) {
    const lastKey = statusToGroupKey(result[result.length - 1]);
    const currentKey = statusToGroupKey(currentStatus);
    if (currentKey === lastKey) {
      const group = PROJECT_STATUS_GROUPS.find((g) => g.key === currentKey);
      if (group) {
        const lastIdx = group.statuses.indexOf(result[result.length - 1] as ProjectStatus);
        const currentIdx = group.statuses.indexOf(currentStatus);
        for (let j = lastIdx + 1; j <= currentIdx; j++) {
          result.push(group.statuses[j]);
        }
      }
    }
  }

  return result;
}

/** 스택에서 그룹 세그먼트(연속된 동일 그룹 엔트리) 경계 계산.
 *  동일 그룹의 인덱스가 역행하면 새 세그먼트로 분리. */
function getGroupSegments(stack: string[]): { key: string; startIdx: number; endIdx: number }[] {
  const segments: { key: string; startIdx: number; endIdx: number }[] = [];
  for (let i = 0; i < stack.length; i++) {
    const key = statusToGroupKey(stack[i]);
    const group = PROJECT_STATUS_GROUPS.find((g) => g.key === key);
    const curIdx = group ? group.statuses.indexOf(stack[i] as ProjectStatus) : -1;
    const last = segments[segments.length - 1];
    if (last && last.key === key) {
      const prevIdx = group ? group.statuses.indexOf(stack[last.endIdx] as ProjectStatus) : -1;
      if (curIdx >= 0 && prevIdx >= 0 && curIdx < prevIdx) {
        segments.push({ key, startIdx: i, endIdx: i });
      } else {
        last.endIdx = i;
      }
    } else {
      segments.push({ key, startIdx: i, endIdx: i });
    }
  }
  return segments;
}

/** 그룹 세그먼트 수 카운트 (인덱스 역행을 새 세그먼트로 취급) */
function countGroupSegments(stack: string[], targetKey: string): number {
  const segments = getGroupSegments(stack);
  return segments.filter((s) => s.key === targetKey).length;
}

/** metadata에서 workflow_stack 읽기 + 정규화 */
function readStack(metadata: Record<string, any> | undefined, currentStatus: ProjectStatus): string[] {
  const saved: string[] | undefined = metadata?.workflow_stack as string[] | undefined;
  const raw = saved && saved.length > 0 ? saved : inferStackFromStatus(currentStatus);
  return normalizeStack(raw, currentStatus);
}

function inferStackFromStatus(currentStatus: ProjectStatus): string[] {
  const allStatuses = Object.keys(PROJECT_STATUS_META) as ProjectStatus[];
  const currentIdx = allStatuses.indexOf(currentStatus);
  const result: string[] = [];
  for (const group of PROJECT_STATUS_GROUPS) {
    for (const s of group.statuses) {
      if (allStatuses.indexOf(s) <= currentIdx) {
        result.push(s);
      }
    }
  }
  return result;
}

// ── Types ────────────────────────────────────────────────

interface ProjectItem {
  id: string;
  code: string;
  title: string;
  clientName: string;
  status: ProjectStatus;
  serviceType: ServiceType;
  ownerName: string;
  totalAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string;
}

interface ProjectDetail {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  status: ProjectStatus;
  service_type: ServiceType;
  payment_type: PaymentType;
  total_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
  client: { id: string; name: string; contact_name: string | null };
  owner: { id: string; name: string } | null;
  documents: {
    id: string;
    type: DocumentType;
    status: DocumentStatus;
    version: number;
    title: string;
    content: Record<string, any>;
    updated_at: string;
    metadata: Record<string, any>;
  }[];
}

interface ClientOption {
  id: string;
  name: string;
}

interface MemberOption {
  id: string;
  name: string;
}

interface EditForm {
  title: string;
  description: string;
  code: string;
  client_id: string;
  owner_id: string;
  service_type: ServiceType;
  payment_type: PaymentType;
  start_date: string;
  end_date: string;
  total_amount: string;
}

interface StatusHistoryItem {
  id: string;
  from_status: string;
  to_status: string;
  note: string | null;
  created_at: string;
  changed_by_name: string | null;
}

function formatCurrency(amount: number | null) {
  if (amount == null) return '-';
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Page ─────────────────────────────────────────────────

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsContent />
    </Suspense>
  );
}

function ProjectsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useFeedback();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('projects_ownerFilter') ?? 'all';
    }
    return 'all';
  });
  const [selected, setSelected] = useState<ProjectItem | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [manualStatuses, setManualStatuses] = useState<Set<string>>(new Set());

  // 수정 모드
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);

  // 종료 사유 모달 상태
  const [closingModal, setClosingModal] = useState<{
    toStatus: ProjectStatus;
    source: 'transition' | 'workflowAdd' | 'workflowStatus';
    groupKey?: string;
  } | null>(null);
  const [closingReason, setClosingReason] = useState('');
  const closingReasonRef = useRef<HTMLTextAreaElement>(null);

  // 활동 로그 (상태 변경 이력)
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyNextCursor, setHistoryNextCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyInitialCount, setHistoryInitialCount] = useState(0);
  const [collapsingHistory, setCollapsingHistory] = useState(false);

  // 입금 플로우 모달 상태
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>('per_invoice');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMonths, setPaymentMonths] = useState('1');

  // 현재 사용자 + 선택된 프로젝트의 담당자 권한
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((u) => setCurrentUserId(u?.id ?? null))
      .catch(() => {});
  }, []);
  const { isAssignee } = useProjectAssignees(
    selected?.id ?? null,
    currentUserId,
    detail?.owner?.id ?? null,
  );

  /** 담당자가 아니면 토스트를 띄우고 false 반환. 담당자면 true. */
  function ensureAssignee(): boolean {
    if (!isAssignee) {
      toast({
        title: '담당자만 수행할 수 있는 작업입니다',
        message: '이 프로젝트의 담당자가 아니므로 작업을 진행할 수 없습니다.',
        variant: 'warning',
      });
      return false;
    }
    return true;
  }

  useEffect(() => {
    fetch('/api/settings/status-check-types')
      .then((r) => r.json())
      .then((rows: { status: string; check_type: string }[]) => {
        const manual = new Set(rows.filter((r) => r.check_type === 'manual').map((r) => r.status));
        setManualStatuses(manual);
      })
      .catch(() => {});

    fetch('/api/clients')
      .then((r) => r.json())
      .then((data: any[]) => setClients(data.map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => {});

    fetch('/api/settings/members')
      .then((r) => r.json())
      .then((data: any[]) => setMembers(data.map((u: any) => ({ id: u.id, name: u.name }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/projects?limit=200')
      .then((r) => r.json())
      .then((res) => {
        const items: ProjectItem[] = (res.data ?? []).map((p: any) => ({
          id: p.id,
          code: p.code ?? '',
          title: p.title,
          clientName: p.client?.name ?? '',
          status: p.status,
          serviceType: p.service_type,
          ownerName: p.owner?.name ?? '-',
          totalAmount: p.total_amount,
          startDate: p.start_date,
          endDate: p.end_date,
          updatedAt: p.updated_at,
        }));
        setProjects(items);
        setLoading(false);

        const selectedId = searchParams.get('selected')
          ?? localStorage.getItem('projects_selectedId');
        if (selectedId) {
          const target = items.find((p) => p.id === selectedId);
          if (target) selectProject(target);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const selectProject = useCallback((p: ProjectItem) => {
    setSelected(p);
    setEditing(false);
    setEditForm(null);
    localStorage.setItem('projects_selectedId', p.id);
    setDetail(null);
    setDetailLoading(true);
    setStatusHistory([]);
    setHistoryNextCursor(null);
    setHistoryHasMore(false);
    fetch(`/api/projects/${p.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error();
        setDetail(data);
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
    // 상태 변경 이력 로드
    fetchStatusHistory(p.id);
  }, []);

  const fetchStatusHistory = useCallback((projectId: string, cursor?: string) => {
    const isLoadMore = !!cursor;
    if (isLoadMore) setHistoryLoadingMore(true);
    else setHistoryLoading(true);
    const url = cursor
      ? `/api/projects/${projectId}/status-history?limit=20&cursor=${encodeURIComponent(cursor)}`
      : `/api/projects/${projectId}/status-history?limit=20`;
    fetch(url)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error();
        if (isLoadMore) {
          setStatusHistory((prev) => [...prev, ...res.items]);
        } else {
          setStatusHistory(res.items ?? []);
          setHistoryInitialCount((res.items ?? []).length);
        }
        setHistoryNextCursor(res.nextCursor ?? null);
        setHistoryHasMore(res.hasMore ?? false);
      })
      .catch(() => {})
      .finally(() => {
        if (isLoadMore) setHistoryLoadingMore(false);
        else setHistoryLoading(false);
      });
  }, []);

  const refreshDetail = useCallback(() => {
    if (!detail) return;
    fetch(`/api/projects/${detail.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setDetail(data);
          setSelected((prev) => prev ? { ...prev, status: data.status } : prev);
          setProjects((prev) => prev.map((p) => p.id === data.id ? { ...p, status: data.status } : p));
        }
      })
      .catch(() => {});
    fetchStatusHistory(detail.id);
  }, [detail?.id, fetchStatusHistory]);

  function startEdit() {
    if (!detail || !selected) return;
    setEditForm({
      title: detail.title,
      description: detail.description ?? '',
      code: detail.code ?? '',
      client_id: detail.client?.id ?? '',
      owner_id: detail.owner?.id ?? '',
      service_type: detail.service_type,
      payment_type: detail.payment_type ?? 'deposit',
      start_date: detail.start_date ?? '',
      end_date: detail.end_date ?? '',
      total_amount: detail.total_amount != null ? String(detail.total_amount) : '',
    });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditForm(null);
  }

  async function saveEdit() {
    if (!editForm || !detail || !selected) return;
    if (!editForm.title.trim()) { alert('프로젝트명은 필수입니다.'); return; }
    if (!editForm.client_id) { alert('고객사를 선택해 주세요.'); return; }

    setSaving(true);
    try {
      const body: Record<string, any> = {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        code: editForm.code.trim() || null,
        client_id: editForm.client_id,
        owner_id: editForm.owner_id || null,
        service_type: editForm.service_type,
        payment_type: editForm.payment_type,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
        total_amount: editForm.total_amount ? Number(editForm.total_amount) : null,
      };
      const res = await fetch(`/api/projects/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error?.message || '수정에 실패했습니다.');
        return;
      }
      // 성공: detail과 selected 갱신
      const clientObj = clients.find((c) => c.id === editForm.client_id);
      const ownerObj = members.find((m) => m.id === editForm.owner_id);
      setDetail((prev) => prev ? {
        ...prev,
        title: body.title, description: body.description, code: body.code,
        service_type: body.service_type, payment_type: body.payment_type,
        start_date: body.start_date, end_date: body.end_date,
        total_amount: body.total_amount,
        client: clientObj ? { ...prev.client, id: clientObj.id, name: clientObj.name } : prev.client,
        owner: ownerObj ? { id: ownerObj.id, name: ownerObj.name } : prev.owner,
      } : prev);
      setSelected((prev) => prev ? {
        ...prev,
        title: body.title, code: body.code ?? '',
        serviceType: body.service_type, totalAmount: body.total_amount,
        startDate: body.start_date, endDate: body.end_date,
        clientName: clientObj?.name ?? prev.clientName,
        ownerName: ownerObj?.name ?? prev.ownerName,
      } : prev);
      setProjects((prev) => prev.map((p) => p.id === detail.id ? {
        ...p, title: body.title, code: body.code ?? '',
        serviceType: body.service_type, totalAmount: body.total_amount,
        startDate: body.start_date, endDate: body.end_date,
        clientName: clientObj?.name ?? p.clientName,
        ownerName: ownerObj?.name ?? p.ownerName,
      } : p));
      setEditing(false);
      setEditForm(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProject() {
    if (!selected) return;
    const confirmed = confirm(
      `"${selected.title}" 프로젝트를 영구 삭제하시겠습니까?\n\n` +
      `연관된 견적서/계약서/입금/집행/환불 등 모든 데이터가 함께 삭제됩니다.\n` +
      `이 작업은 되돌릴 수 없습니다.`,
    );
    if (!confirmed) return;

    const deletingId = selected.id;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${deletingId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error?.message || '프로젝트 삭제에 실패했습니다.');
        return;
      }
      setProjects((prev) => prev.filter((p) => p.id !== deletingId));
      setSelected(null);
      setDetail(null);
      setEditing(false);
      setEditForm(null);
    } finally {
      setDeleting(false);
    }
  }

  function handleTransition(toStatus: ProjectStatus) {
    if (!detail || !selected) return;
    // H 그룹(종료) 전환 시 종료 사유 모달 표시
    if (toStatus === 'H1_closed') {
      setClosingReason('');
      setClosingModal({ toStatus, source: 'transition' });
      return;
    }
    const label = PROJECT_STATUS_META[toStatus]?.label ?? toStatus;
    if (!confirm(`상태를 "${label}"(으)로 변경하시겠습니까?`)) return;
    fetch(`/api/projects/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: toStatus }),
    })
      .then((r) => r.json())
      .then(() => {
        selectProject({ ...selected, status: toStatus });
      })
      .catch(() => alert('상태 변경에 실패했습니다.'));
  }

  // 그룹 → 문서 타입 매핑
  const GROUP_DOC_TYPE_MAP: Record<string, { type: string; suffix: string }> = {
    B: { type: 'estimate', suffix: '견적서' },
    C: { type: 'contract', suffix: '계약서' },
    E: { type: 'pre_report', suffix: '사전보고서' },
  };

  function handleWorkflowAdd(groupKey: string, paymentAmount?: number) {
    if (!detail || !selected) return;
    if (!ensureAssignee()) return;
    // H 그룹(종료) 추가 시 종료 사유 모달 표시
    if (groupKey === 'H') {
      setClosingReason('');
      setClosingModal({ toStatus: 'H1_closed' as ProjectStatus, source: 'workflowAdd', groupKey: 'H' });
      return;
    }
    // D 그룹(입금) 추가 시 결제 모달 표시 (paymentAmount 없으면)
    if (groupKey === 'D' && paymentAmount == null) {
      setPaymentType('per_invoice');
      setPaymentAmount('');
      setPaymentMonths('1');
      setPaymentModal(true);
      return;
    }
    // G 그룹(환불) 추가 시 환불 금액 저장 후 상태 변경
    if (groupKey === 'G' && paymentAmount != null) {
      const currentStack = readStack(detail.metadata, selected.status);
      const newStatus = 'G1_refund' as ProjectStatus;
      const newStack = [...currentStack, newStatus];
      const newMeta = { ...detail.metadata, workflow_stack: newStack };
      setDetail((prev) => prev ? { ...prev, status: newStatus, metadata: newMeta } : prev);
      setSelected((prev) => prev ? { ...prev, status: newStatus } : prev);
      setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: newStatus } : p));
      fetch(`/api/projects/${detail.id}/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: paymentAmount }),
      }).then((r) => {
        if (!r.ok) throw new Error();
        return fetch(`/api/projects/${detail.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus, metadata: newMeta }),
        });
      }).then((r) => {
        if (!r.ok) throw new Error();
      }).catch(() => {
        setDetail((prev) => prev ? { ...prev, status: selected.status, metadata: detail.metadata } : prev);
        setSelected((prev) => prev ? { ...prev, status: selected.status } : prev);
        setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: selected.status } : p));
        alert('환불 처리에 실패했습니다.');
      });
      return;
    }
    const currentStack = readStack(detail.metadata, selected.status);
    const group = PROJECT_STATUS_GROUPS.find((g) => g.key === groupKey);
    const newStatus = groupKey === 'D'
      ? 'D1_payment_pending' as ProjectStatus
      : (group?.statuses[0] ?? selected.status) as ProjectStatus;
    const newStack = [...currentStack, newStatus];
    const newMeta = { ...detail.metadata, workflow_stack: newStack };
    const newAmount = groupKey === 'D' && paymentAmount != null ? paymentAmount : selected.totalAmount;
    setDetail((prev) => prev ? { ...prev, status: newStatus, metadata: newMeta, total_amount: newAmount } : prev);
    setSelected((prev) => prev ? { ...prev, status: newStatus, totalAmount: newAmount } : prev);
    setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: newStatus, totalAmount: newAmount } : p));
    const patchBody: Record<string, any> = { status: newStatus, metadata: newMeta };
    if (groupKey === 'D' && paymentAmount != null) {
      patchBody.total_amount = paymentAmount;
    }
    // 프로젝트 상태 변경 후 문서 생성
    fetch(`/api/projects/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
    }).then((r) => {
      if (!r.ok) throw new Error();
      // 해당 그룹에 연결된 문서 자동 생성 (B/C/E)
      const docConfig = GROUP_DOC_TYPE_MAP[groupKey];
      if (docConfig) {
        const flowNumber = countGroupSegments(newStack, groupKey);
        const numSuffix = flowNumber > 1 ? ` #${flowNumber}` : '';
        return fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: detail.id,
            type: docConfig.type,
            title: `${detail.title} ${docConfig.suffix}${numSuffix}`,
            content: { flow_number: flowNumber },
          }),
        });
      }
      return null;
    }).then((r) => {
      if (r && !r.ok) throw new Error();
      // 문서 목록 갱신을 위해 detail 리로드
      return fetch(`/api/projects/${detail.id}`).then((r2) => r2.json());
    }).then((data) => {
      if (data && !data.error) setDetail(data);
    }).catch(() => {
      setDetail((prev) => prev ? { ...prev, status: selected.status, metadata: detail.metadata, total_amount: selected.totalAmount } : prev);
      setSelected((prev) => prev ? { ...prev, status: selected.status, totalAmount: selected.totalAmount } : prev);
      setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: selected.status, totalAmount: selected.totalAmount } : p));
      alert('상태 변경에 실패했습니다.');
    });
  }

  // 입금 모달 확인 핸들러
  function handlePaymentConfirm() {
    const amount = parseInt(paymentAmount.replace(/[^0-9]/g, ''), 10);
    if (isNaN(amount) || amount <= 0) {
      alert('올바른 금액을 입력해주세요.');
      return;
    }
    const months = parseInt(paymentMonths, 10) || 1;
    if ((paymentType === 'deposit' || paymentType === 'monthly') && months < 1) {
      alert('개월 수를 입력해주세요.');
      return;
    }
    setPaymentModal(false);
    if (!detail || !selected) return;
    const currentStack = readStack(detail.metadata, selected.status);
    const newStatus = 'D1_payment_pending' as ProjectStatus;
    const newStack = [...currentStack, newStatus];
    const paymentInfo: Record<string, unknown> = { type: paymentType, amount };
    if (paymentType === 'deposit') paymentInfo.months_covered = months;
    if (paymentType === 'monthly') paymentInfo.installment_months = months;
    const totalAmount = amount;
    const newMeta = {
      ...detail.metadata,
      workflow_stack: newStack,
      payment_info: paymentInfo,
    };
    // 낙관적 업데이트
    setDetail((prev) => prev ? { ...prev, status: newStatus, metadata: newMeta, total_amount: totalAmount } : prev);
    setSelected((prev) => prev ? { ...prev, status: newStatus, totalAmount: totalAmount } : prev);
    setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: newStatus, totalAmount: totalAmount } : p));
    // 프로젝트 상태 변경 후 입금 문서 생성
    fetch(`/api/projects/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, metadata: newMeta, total_amount: totalAmount }),
    }).then((r) => {
      if (!r.ok) throw new Error();
      // 입금 확인 문서 생성
      const flowNumber = countGroupSegments(newStack, 'D');
      const numSuffix = flowNumber > 1 ? ` #${flowNumber}` : '';
      return fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: detail.id,
          type: 'payment',
          title: `${detail.title} 입금확인${numSuffix}`,
          content: {
            payment_type: paymentType,
            amount,
            months: (paymentType === 'deposit' || paymentType === 'monthly') ? months : undefined,
            flow_number: flowNumber,
          },
        }),
      });
    }).then((r) => {
      if (r && !r.ok) throw new Error();
      // detail 리로드
      return fetch(`/api/projects/${detail.id}`).then((r2) => r2.json());
    }).then((data) => {
      if (data && !data.error) setDetail(data);
    }).catch(() => {
      setDetail((prev) => prev ? { ...prev, status: selected.status, metadata: detail.metadata, total_amount: selected.totalAmount } : prev);
      setSelected((prev) => prev ? { ...prev, status: selected.status, totalAmount: selected.totalAmount } : prev);
      setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: selected.status, totalAmount: selected.totalAmount } : p));
      alert('상태 변경에 실패했습니다.');
    });
  }

  async function handleWorkflowDelete(index: number) {
    if (!detail || !selected) return;
    if (!ensureAssignee()) return;
    const currentStack = readStack(detail.metadata, selected.status);

    // index는 세그먼트(표시 그룹) 인덱스 → 실제 스택 범위 계산
    const segments = getGroupSegments(currentStack);
    const segment = segments[index];
    if (!segment) return;
    const deletedGroupKey = segment.key;

    // 동일 그룹 내에서 이 세그먼트의 flow_number (1부터 시작)
    let deletedFlowNumber = 0;
    for (let i = 0; i <= index; i++) {
      if (segments[i].key === deletedGroupKey) deletedFlowNumber++;
    }

    // 삭제할 그룹에 연결된 문서 타입 매핑
    const groupDocTypeMap: Record<string, { type: string; label: string }> = {
      B: { type: 'estimate', label: '견적서' },
      C: { type: 'contract', label: '계약서' },
      D: { type: 'payment', label: '입금확인' },
      E: { type: 'pre_report', label: '사전보고서' },
    };

    const docConfig = groupDocTypeMap[deletedGroupKey];
    const groupLabel = PROJECT_STATUS_GROUPS.find((g) => g.key === deletedGroupKey)?.label ?? deletedGroupKey;

    // 해당 타입의 문서 중 이 세그먼트(flow_number)에 매칭되는 문서만 추림.
    //  - content.flow_number 가 일치하면 그 문서.
    //  - flow_number 가 비어있는 레거시 문서는 정렬 순서상 deletedFlowNumber 번째 위치를 매칭.
    let docsOfType: { id: string; type: string }[] = [];
    if (docConfig && detail.documents) {
      const allOfType = detail.documents.filter((d) => d.type === docConfig.type);
      const byFlow = allOfType.find((d) => (d.content as any)?.flow_number === deletedFlowNumber);
      if (byFlow) {
        docsOfType = [byFlow];
      } else {
        // flow_number 미설정 레거시 케이스: 같은 타입 문서가 1건뿐이거나
        // deletedFlowNumber 번째 (1-indexed) 위치 문서를 대상으로 한다.
        const noFlow = allOfType.filter((d) => (d.content as any)?.flow_number == null);
        const fallback = noFlow[deletedFlowNumber - 1];
        if (fallback) docsOfType = [fallback];
      }
    }

    // 경고 메시지 구성
    let message = `"${groupLabel}" 단계를 삭제하시겠습니까?`;
    if (docsOfType.length > 0) {
      message += `\n\n⚠️ 연결된 ${docConfig!.label} ${docsOfType.length}건이 함께 삭제됩니다.\n삭제된 문서는 복구할 수 없습니다.`;
    }
    if (deletedGroupKey === 'G') {
      message += `\n\n⚠️ 환불 내역도 함께 삭제됩니다.`;
    }

    if (!confirm(message)) return;

    // 세그먼트 전체 제거
    const newStack = currentStack.filter((_, i) => i < segment.startIdx || i > segment.endIdx);
    let newStatus: ProjectStatus = 'A_sales';
    if (newStack.length > 0) {
      const lastStatus = newStack[newStack.length - 1];
      // 스택의 마지막 상태를 그대로 사용
      if (Object.keys(PROJECT_STATUS_META).includes(lastStatus)) {
        newStatus = lastStatus as ProjectStatus;
      } else {
        const group = PROJECT_STATUS_GROUPS.find((g) => g.key === lastStatus);
        if (group) newStatus = group.statuses[group.statuses.length - 1];
      }
    }

    // 낙관적 업데이트
    const newMeta = { ...detail.metadata, workflow_stack: newStack };
    const prevDocuments = detail.documents;
    const deleteDocIds = new Set(docsOfType.map((d) => d.id));
    setDetail((prev) => prev ? {
      ...prev,
      status: newStatus,
      metadata: newMeta,
      documents: deleteDocIds.size > 0 ? prev.documents.filter((d) => !deleteDocIds.has(d.id)) : prev.documents,
    } : prev);
    setSelected((prev) => prev ? { ...prev, status: newStatus } : prev);
    setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: newStatus } : p));

    // 병렬 삭제 요청
    const deletions: Promise<any>[] = [];

    // 해당 세그먼트에 매칭되는 문서만 개별 삭제
    if (docsOfType.length > 0) {
      for (const d of docsOfType) {
        deletions.push(
          fetch(`/api/documents/${d.id}`, { method: 'DELETE' }),
        );
      }
    }

    // G(환불) 그룹 삭제 시 환불 내역도 함께 삭제
    if (deletedGroupKey === 'G') {
      deletions.push(
        fetch(`/api/projects/${detail.id}/refunds`, { method: 'DELETE' }),
      );
    }

    // 프로젝트 상태 + 메타데이터 갱신
    deletions.push(
      fetch(`/api/projects/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, metadata: newMeta }),
      }),
    );

    Promise.all(deletions).catch(() => {
      setDetail((prev) => prev ? { ...prev, status: selected.status, metadata: detail.metadata, documents: prevDocuments } : prev);
      setSelected((prev) => prev ? { ...prev, status: selected.status } : prev);
      setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: selected.status } : p));
      alert('상태 변경에 실패했습니다.');
    });
  }

  function handleWorkflowStatusChange(toStatus: ProjectStatus) {
    if (!detail || !selected) return;
    if (!ensureAssignee()) return;
    // H 그룹(종료) 상태 변경 시 종료 사유 모달 표시
    if (toStatus === 'H1_closed') {
      setClosingReason('');
      setClosingModal({ toStatus, source: 'workflowStatus' });
      return;
    }
    const prevStatus = selected.status;
    const currentStack = readStack(detail.metadata, selected.status);

    // 마지막 세그먼트 시작 위치 찾기
    const lastKey = currentStack.length > 0 ? statusToGroupKey(currentStack[currentStack.length - 1]) : '';
    let segStart = currentStack.length - 1;
    while (segStart > 0 && statusToGroupKey(currentStack[segStart - 1]) === lastKey) segStart--;

    // 대상 상태가 현재 세그먼트에 이미 있으면 → 롤백 (해당 위치까지 truncate)
    const targetIdxInStack = currentStack.indexOf(toStatus, segStart);
    let newStack: string[];
    if (targetIdxInStack >= segStart) {
      // 롤백: 해당 상태까지만 유지
      newStack = currentStack.slice(0, targetIdxInStack + 1);
    } else {
      // 전진: 현재 마지막 상태와 대상 사이의 모든 중간 상태도 추가
      const group = PROJECT_STATUS_GROUPS.find((g) => g.key === statusToGroupKey(toStatus));
      if (group) {
        const lastInStack = currentStack[currentStack.length - 1];
        const lastIdx = group.statuses.indexOf(lastInStack as ProjectStatus);
        const targetIdx = group.statuses.indexOf(toStatus);
        const newEntries = group.statuses.slice(lastIdx + 1, targetIdx + 1);
        newStack = [...currentStack, ...newEntries];
      } else {
        newStack = [...currentStack, toStatus];
      }
    }

    const newMeta = { ...detail.metadata, workflow_stack: newStack };
    // 낙관적 업데이트
    setDetail((prev) => prev ? { ...prev, status: toStatus, metadata: newMeta } : prev);
    setSelected((prev) => prev ? { ...prev, status: toStatus } : prev);
    setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: toStatus } : p));
    fetch(`/api/projects/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: toStatus, metadata: newMeta }),
    }).then(async (r) => {
      if (!r.ok) throw new Error();
      // D2 입금 완료 전환 시 → 해당 입금 문서에 confirmed_at 기록
      if (toStatus === ('D2_payment_confirmed' as ProjectStatus) && detail.documents) {
        const paymentDocs = detail.documents.filter((d) => d.type === 'payment');
        const targetDoc = paymentDocs.find((d) => !(d.content as Record<string, unknown>)?.confirmed_at);
        if (targetDoc) {
          const prevContent = (targetDoc.content ?? {}) as Record<string, unknown>;
          await fetch(`/api/documents/${targetDoc.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: { ...prevContent, confirmed_at: new Date().toISOString() } }),
          });
          // detail 리로드
          const data = await fetch(`/api/projects/${detail.id}`).then((r2) => r2.json());
          if (data && !data.error) setDetail(data);
        }
      }
    }).catch(() => {
      setDetail((prev) => prev ? { ...prev, status: prevStatus, metadata: detail.metadata } : prev);
      setSelected((prev) => prev ? { ...prev, status: prevStatus } : prev);
      setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: prevStatus } : p));
      alert('상태 변경에 실패했습니다.');
    });
  }

  // 종료 사유 모달 확인 핸들러
  async function handleClosingConfirm() {
    if (!closingModal || !detail || !selected) return;
    const { toStatus, source, groupKey } = closingModal;
    const reason = closingReason.trim();
    const closedAt = new Date().toISOString();

    if (source === 'workflowAdd' && groupKey) {
      // 워크플로우에 G 그룹 추가 — 단일 PATCH로 status + metadata 동시 변경
      const currentStack = readStack(detail.metadata, selected.status);
      const newStack = [...currentStack, toStatus];
      const newMeta = {
        ...detail.metadata,
        workflow_stack: newStack,
        closing_reason: reason,
        closed_at: closedAt,
      };
      setDetail((prev) => prev ? { ...prev, status: toStatus, metadata: newMeta } : prev);
      setSelected((prev) => prev ? { ...prev, status: toStatus } : prev);
      setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: toStatus } : p));
      fetch(`/api/projects/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: toStatus, metadata: newMeta }),
      }).then((r) => {
        if (!r.ok) throw new Error();
      }).catch(() => {
        setDetail((prev) => prev ? { ...prev, status: selected.status, metadata: detail.metadata } : prev);
        setSelected((prev) => prev ? { ...prev, status: selected.status } : prev);
        setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: selected.status } : p));
        alert('상태 변경에 실패했습니다.');
      });
    } else {
      // transition / workflowStatus: 단일 PATCH로 상태 변경
      const prevStatus = selected.status;
      const newMeta = {
        ...detail.metadata,
        closing_reason: reason,
        closed_at: closedAt,
      };
      setDetail((prev) => prev ? { ...prev, status: toStatus, metadata: newMeta } : prev);
      setSelected((prev) => prev ? { ...prev, status: toStatus } : prev);
      setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: toStatus } : p));
      fetch(`/api/projects/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: toStatus, metadata: newMeta }),
      }).then((r) => {
        if (!r.ok) throw new Error();
        if (source === 'transition') selectProject({ ...selected, status: toStatus });
      }).catch(() => {
        setDetail((prev) => prev ? { ...prev, status: prevStatus, metadata: detail.metadata } : prev);
        setSelected((prev) => prev ? { ...prev, status: prevStatus } : prev);
        setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: prevStatus } : p));
        alert('상태 변경에 실패했습니다.');
      });
    }
    setClosingModal(null);
    setClosingReason('');
  }

  const ownerNames = Array.from(new Set(projects.map((p) => p.ownerName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));

  const filtered = projects.filter((p) => {
    if (groupFilter !== 'all') {
      const group = PROJECT_STATUS_GROUPS.find(g => g.key === groupFilter);
      if (group && !group.statuses.includes(p.status)) return false;
    }
    if (ownerFilter !== 'all' && p.ownerName !== ownerFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className={panel.wrapper}>
        <div className={panel.leftPanel}>
          <div className={panel.leftHeader}>
            <span className={panel.leftTitle}>프로젝트</span>
            <div className={panel.searchInput} style={{ opacity: 0.5 }} />
          </div>
          <div className={panel.itemList}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={panel.skeletonItem}>
                <div className={panel.skeletonBar} style={{ width: '70%' }} />
                <div className={panel.skeletonBar} style={{ width: '45%', height: 8 }} />
              </div>
            ))}
          </div>
        </div>
        <div className={panel.rightPanel}>
          <div className={panel.emptyState}>
            <span className={panel.emptyIcon}><LuFolderOpen size={32} /></span>
            <span>프로젝트를 선택하세요</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={panel.wrapper}>
      {/* ── Left Panel ── */}
      <div className={`${panel.leftPanel} ${expanded ? panel.leftPanelExpanded : ''}`}>
        <div className={panel.leftHeader}>
          <div className={panel.leftTitleRow}>
            <span className={panel.leftTitle}>프로젝트</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                className={panel.sortSelect}
                value={ownerFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  setOwnerFilter(v);
                  localStorage.setItem('projects_ownerFilter', v);
                }}
              >
                <option value="all">담당자: 전체</option>
                {ownerNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button
                type="button"
                className={panel.expandBtn}
                onClick={() => setExpanded((v) => !v)}
                title={expanded ? '접기' : '펼치기'}
              >
                {expanded ? <LuPanelLeftClose size={16} /> : <LuPanelLeftOpen size={16} />}
              </button>
            </div>
          </div>
          <input
            className={panel.searchInput}
            placeholder="프로젝트명, 고객사 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {!expanded && (
            <div className={panel.filterTabs}>
              <button
                type="button"
                className={`${panel.filterTab} ${groupFilter === 'all' ? panel.filterTabActive : ''}`}
                onClick={() => setGroupFilter('all')}
              >전체</button>
              {PROJECT_STATUS_GROUPS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  className={`${panel.filterTab} ${groupFilter === g.key ? panel.filterTabActive : ''}`}
                  onClick={() => setGroupFilter(g.key)}
                >{g.label}</button>
              ))}
            </div>
          )}
        </div>

        {expanded ? (
          /* ── Expanded: Kanban Columns ── */
          <div className={panel.boardColumns}>
            {PROJECT_STATUS_GROUPS.map((group) => {
              const searchFiltered = projects.filter((p) => {
                if (!group.statuses.includes(p.status)) return false;
                if (ownerFilter !== 'all' && p.ownerName !== ownerFilter) return false;
                if (search) {
                  const q = search.toLowerCase();
                  return p.title.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
                }
                return true;
              });
              return (
                <div key={group.key} className={panel.boardColumn}>
                  <div className={panel.boardColumnHeader}>
                    <span className={panel.boardColumnTitle}>{group.label}</span>
                    <span className={panel.boardColumnCount}>{searchFiltered.length}</span>
                  </div>
                  <div className={panel.boardColumnBody}>
                    {searchFiltered.length === 0 ? (
                      <div className={panel.boardEmpty}>프로젝트 없음</div>
                    ) : (
                      searchFiltered.map((p) => (
                        <div
                          key={p.id}
                          className={`${panel.boardCard} ${selected?.id === p.id ? panel.boardCardActive : ''}`}
                          onClick={() => { selectProject(p); setExpanded(false); }}
                        >
                          <div className={panel.boardCardTitle}>{p.title}</div>
                          <div className={panel.boardCardMeta}>
                            <span>{p.clientName}</span>
                            <span>·</span>
                            <span>{p.ownerName}</span>
                            <span>·</span>

                            <StatusBadge status={p.status} type="project" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Collapsed: Normal List ── */
          <>
            <div className={panel.itemList}>
              {filtered.map((p) => {
                const isClosed = p.status === 'H1_closed';
                return (
                  <div
                    key={p.id}
                    className={`${panel.item} ${selected?.id === p.id ? panel.itemActive : ''}`}
                    onClick={() => selectProject(p)}
                    style={isClosed ? {
                      opacity: 0.6,
                      background: 'repeating-linear-gradient(135deg, transparent, transparent 8px, rgba(0,0,0,0.03) 8px, rgba(0,0,0,0.03) 16px)',
                    } : undefined}
                  >
                    <span
                      className={panel.itemName}
                      style={isClosed ? {
                        color: 'var(--color-text-muted)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      } : undefined}
                    >
                      {isClosed && <LuBan size={13} style={{ color: '#9ca3af', flexShrink: 0 }} />}
                      {p.title}
                    </span>
                    <span className={panel.itemMeta}>
                      <span>{p.clientName}</span>
                      <span>·</span>
                      <span>{p.ownerName}</span>
                      <span>·</span>
                      <StatusBadge status={p.status} type="project" />
                    </span>
                  </div>
                );
              })}
            </div>
            <div className={panel.leftFooter}>{filtered.length}개 프로젝트</div>
          </>
        )}
      </div>

      {/* ── Right Panel ── */}
      {!expanded && (
      <div className={panel.rightPanel}>
        {!selected ? (
          <div className={panel.emptyState}>
            <span className={panel.emptyIcon}><LuFolderOpen size={32} /></span>
            <span>프로젝트를 선택하세요</span>
          </div>
        ) : (
          <>
            <div className={panel.detailHeader}>
              <div>
                <div className={panel.detailTitle}>{selected.title}</div>
                <div className={panel.detailSubtitle}>
                  {selected.code} · {selected.clientName}
                </div>
              </div>
              <div className={panel.detailActions}>
                {!editing && selected.status !== 'F1_execution' && (
                  <ActionButton label="수정" variant="ghost-filled" size="sm" icon={<LuPencil size={13} />} onClick={startEdit} />
                )}
                {editing && (
                  <>
                    <ActionButton label="취소" variant="ghost" size="sm" icon={<LuX size={13} />} onClick={cancelEdit} disabled={saving || deleting} />
                    <ActionButton
                      label={deleting ? '삭제 중...' : '삭제'}
                      variant="danger"
                      size="sm"
                      icon={<LuTrash2 size={13} />}
                      onClick={handleDeleteProject}
                      disabled={saving || deleting}
                    />
                    <ActionButton label={saving ? '저장 중...' : '저장'} variant="primary" size="sm" icon={<LuCheck size={13} />} onClick={saveEdit} disabled={saving || deleting} />
                  </>
                )}
              </div>
            </div>

            {/* ── 종료 프로젝트 배너 ── */}
            {selected.status === 'H1_closed' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 16px',
                  marginBottom: 12,
                  borderRadius: 10,
                  border: '1px solid #fecaca',
                  background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                  boxShadow: '0 1px 2px rgba(220, 38, 38, 0.06)',
                }}
              >
                <div
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#dc2626', flexShrink: 0,
                    boxShadow: '0 1px 3px rgba(220, 38, 38, 0.12)',
                  }}
                >
                  <LuBan size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>
                      종료된 프로젝트
                    </span>
                    {detail?.metadata?.closed_at && (
                      <span style={{ fontSize: 11, color: '#991b1b', opacity: 0.75 }}>
                        · {formatDate(detail.metadata.closed_at)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.5, wordBreak: 'break-word' }}>
                    <span style={{ fontWeight: 600 }}>종료 사유: </span>
                    {detail?.metadata?.closing_reason
                      ? detail.metadata.closing_reason
                      : <span style={{ opacity: 0.6, fontStyle: 'italic' }}>기록된 사유가 없습니다</span>}
                  </div>
                </div>
              </div>
            )}

            {/* 프로젝트 기본 정보 */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className={panel.formTable}>
                <tbody>
                  <tr>
                    <th>상태</th>
                    <td><StatusBadge status={selected.status} type="project" size="md" /></td>
                  </tr>
                  {editing && editForm ? (
                    <>
                      <tr>
                        <th>프로젝트명 *</th>
                        <td>
                          <input type="text" className="form-input" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                        </td>
                      </tr>
                      <tr>
                        <th>프로젝트 코드</th>
                        <td>
                          <input type="text" className="form-input" value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} />
                        </td>
                      </tr>
                      <tr>
                        <th>고객사 *</th>
                        <td>
                          <select className="form-input" value={editForm.client_id} onChange={(e) => setEditForm({ ...editForm, client_id: e.target.value })}>
                            <option value="">선택하세요</option>
                            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </td>
                      </tr>
                      <tr>
                        <th>서비스 유형</th>
                        <td>
                          <select className="form-input" value={editForm.service_type} onChange={(e) => setEditForm({ ...editForm, service_type: e.target.value as ServiceType })}>
                            {SERVICE_TYPES.map((st) => <option key={st} value={st}>{SERVICE_TYPE_META[st].label}</option>)}
                          </select>
                        </td>
                      </tr>
                      <tr>
                        <th>결제 방식</th>
                        <td>
                          <select className="form-input" value={editForm.payment_type} onChange={(e) => setEditForm({ ...editForm, payment_type: e.target.value as PaymentType })}>
                            {PAYMENT_TYPES.map((pt) => <option key={pt} value={pt}>{PAYMENT_TYPE_META[pt].label}</option>)}
                          </select>
                        </td>
                      </tr>
                      <tr>
                        <th>담당자</th>
                        <td>
                          <select className="form-input" value={editForm.owner_id} onChange={(e) => setEditForm({ ...editForm, owner_id: e.target.value })}>
                            <option value="">선택하세요</option>
                            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </td>
                      </tr>
                      <tr>
                        <th>계약 금액</th>
                        <td>
                          <input type="number" className="form-input" placeholder="원" value={editForm.total_amount} onChange={(e) => setEditForm({ ...editForm, total_amount: e.target.value })} />
                        </td>
                      </tr>
                      <tr>
                        <th>시작일</th>
                        <td>
                          <input type="date" className="form-input" value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} />
                        </td>
                      </tr>
                      <tr>
                        <th>종료일</th>
                        <td>
                          <input type="date" className="form-input" value={editForm.end_date} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} />
                        </td>
                      </tr>
                      <tr>
                        <th>설명</th>
                        <td>
                          <textarea className="form-input" rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} style={{ resize: 'vertical' }} />
                        </td>
                      </tr>
                    </>
                  ) : (
                    <>
                      <tr>
                        <th>고객사</th>
                        <td>
                          <span className={panel.fieldValue}>
                            {detail?.client?.id ? (
                              <a href={`/clients?selected=${detail.client.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {detail.client.name}
                                <LuExternalLink size={12} style={{ opacity: 0.6 }} />
                              </a>
                            ) : selected.clientName}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <th>서비스 유형</th>
                        <td><span className={panel.fieldValue}>{SERVICE_TYPE_META[selected.serviceType]?.label ?? '-'}</span></td>
                      </tr>
                      <tr>
                        <th>결제 방식</th>
                        <td><span className={panel.fieldValue}>{detail?.payment_type ? PAYMENT_TYPE_META[detail.payment_type]?.label ?? '-' : '-'}</span></td>
                      </tr>
                      <tr>
                        <th>담당자</th>
                        <td><span className={panel.fieldValue}>{detail?.owner?.name ?? selected.ownerName}</span></td>
                      </tr>
                      <tr>
                        <th>계약 금액</th>
                        <td><span className={panel.fieldValue}>{formatCurrency(selected.totalAmount)}</span></td>
                      </tr>
                      <tr>
                        <th>기간</th>
                        <td><span className={panel.fieldValue}>{formatDate(selected.startDate)} ~ {formatDate(selected.endDate)}</span></td>
                      </tr>
                      {detail?.description && (
                        <tr>
                          <th>설명</th>
                          <td><span className={panel.fieldValue}>{detail.description}</span></td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* 워크플로우 진행 현황 */}
            <div className={panel.detailSection}>
              {detailLoading ? (
                <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  워크플로우를 불러오는 중...
                </div>
              ) : (
                <WorkflowBuilder
                  serviceType={selected.serviceType}
                  projectStatus={selected.status}
                  workflowStack={(detail?.metadata?.workflow_stack as string[]) ?? []}
                  manualStatuses={manualStatuses}
                  documents={detail?.documents}
                  onAdd={handleWorkflowAdd}
                  onDelete={handleWorkflowDelete}
                  onStatusChange={handleWorkflowStatusChange}
                  onRefresh={refreshDetail}
                />
              )}
            </div>

            {/* 문서 목록 */}
            <div className={panel.detailSection}>
              <div className={panel.detailSectionTitle}>문서 목록</div>
              {detailLoading ? (
                <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  문서를 불러오는 중...
                </div>
              ) : !detail?.documents?.length ? (
                <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  등록된 문서가 없습니다.
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>구분</th>
                        <th>제목</th>
                        <th>상태</th>
                        <th>버전</th>
                        <th>최종 수정</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.documents.filter((doc) => doc.type !== 'payment').map((doc) => (
                        <tr key={doc.id}>
                          <td>{DOCUMENT_TYPE_META[doc.type]?.label ?? doc.type}</td>
                          <td style={{ fontWeight: 500 }}>{doc.title}</td>
                          <td><StatusBadge status={doc.status} type="document" /></td>
                          <td>v{doc.version}</td>
                          <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{formatDateTime(doc.updated_at)}</td>
                          <td>
                            {doc.metadata?.pdf_path && doc.status === 'approved' && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                title="PDF 다운로드"
                                onClick={async () => {
                                  const res = await fetch(`/api/documents/${doc.id}/pdf`);
                                  if (!res.ok) { alert('PDF를 불러올 수 없습니다.'); return; }
                                  const { url } = await res.json();
                                  window.open(url, '_blank');
                                }}
                              >
                                <LuDownload size={14} />
                              </button>
                            )}
                            {doc.type === 'contract' && doc.content?.file_path && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                title="계약서 다운로드"
                                onClick={async () => {
                                  const res = await fetch(`/api/documents/${doc.id}/file-url`);
                                  if (!res.ok) { alert('파일을 불러올 수 없습니다.'); return; }
                                  const { url } = await res.json();
                                  window.open(url, '_blank');
                                }}
                              >
                                <LuDownload size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 활동 로그 (상태 변경 이력) */}
            <div className={panel.detailSection}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className={panel.detailSectionTitle} style={{ margin: 0 }}>활동 로그</div>
                <button
                  type="button"
                  onClick={() => selected && fetchStatusHistory(selected.id)}
                  title="활동 로그 새로고침"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, border: 'none', borderRadius: 4,
                    background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer',
                    transition: 'color 0.1s, background 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; e.currentTarget.style.background = 'var(--color-bg)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'none'; }}
                >
                  <LuRefreshCw size={14} />
                </button>
              </div>
              {historyLoading ? (
                <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  로그를 불러오는 중...
                </div>
              ) : statusHistory.length === 0 ? (
                <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  상태 변경 이력이 없습니다.
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table className="data-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '6px 10px' }}>이전</th>
                        <th style={{ padding: '6px 10px' }}>변경</th>
                        <th style={{ padding: '6px 10px' }}>사유</th>
                        <th style={{ padding: '6px 10px' }}>변경자</th>
                        <th style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>일시</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusHistory.map((h, index) => {
                        const isExtra = collapsingHistory && index >= historyInitialCount;
                        return (
                          <tr
                            key={h.id}
                            style={{
                              transition: 'opacity 0.28s ease, transform 0.28s ease',
                              opacity: isExtra ? 0 : 1,
                              transform: isExtra ? 'translateY(-6px)' : 'translateY(0)',
                            }}
                          >
                            <td style={{ padding: '5px 10px' }}><StatusBadge status={h.from_status as ProjectStatus} type="project" /></td>
                            <td style={{ padding: '5px 10px' }}><StatusBadge status={h.to_status as ProjectStatus} type="project" /></td>
                            <td style={{ padding: '5px 10px', color: 'var(--color-text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.note ?? undefined}>{h.note ?? '-'}</td>
                            <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>{h.changed_by_name ?? '시스템'}</td>
                            <td style={{ padding: '5px 10px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(h.created_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {historyHasMore && (
                    <button
                      type="button"
                      onClick={() => selected && historyNextCursor && fetchStatusHistory(selected.id, historyNextCursor)}
                      disabled={historyLoadingMore}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        width: '100%', padding: '10px 0', border: 'none', background: 'none',
                        cursor: 'pointer', fontSize: 12, color: 'var(--color-primary, #3b82f6)',
                        borderTop: '1px solid var(--color-border-light, #f0f0f0)',
                      }}
                    >
                      <LuChevronDown size={14} />
                      {historyLoadingMore ? '불러오는 중...' : '더 보기'}
                    </button>
                  )}
                  {!historyHasMore && statusHistory.length > historyInitialCount && historyInitialCount > 0 && (
                    <button
                      type="button"
                      disabled={collapsingHistory}
                      onClick={() => {
                        setCollapsingHistory(true);
                        setTimeout(() => {
                          setStatusHistory((prev) => prev.slice(0, historyInitialCount));
                          setHistoryHasMore(true);
                          setHistoryNextCursor(statusHistory[historyInitialCount - 1]?.created_at ?? null);
                          setCollapsingHistory(false);
                        }, 300);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        width: '100%', padding: '10px 0', border: 'none', background: 'none',
                        cursor: 'pointer', fontSize: 12, color: 'var(--color-text-muted)',
                        borderTop: '1px solid var(--color-border-light, #f0f0f0)',
                        transition: 'opacity 0.2s ease',
                        opacity: collapsingHistory ? 0.5 : 1,
                      }}
                    >
                      <LuChevronUp size={14} style={{ transition: 'transform 0.2s ease', transform: collapsingHistory ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                      {collapsingHistory ? '접는 중...' : '접기'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      )}

      {/* ── 입금 플로우 모달 ── */}
      {paymentModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              width: 480, maxWidth: 'calc(100vw - 32px)',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)', boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '20px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#d97706', flexShrink: 0,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                    입금 플로우 추가
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                    결제 유형과 금액을 입력해 주세요.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              {/* 문서 정보 참조 — 견적서/계약서 전체 나열, 클릭으로 자동 입력 */}
              {(() => {
                const docs = (detail?.documents ?? []).filter((d) => d.type === 'estimate' || d.type === 'contract');
                if (docs.length === 0) return null;
                return (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, display: 'block' }}>
                      문서 정보 참조
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {docs.map((doc) => {
                        const typeMeta = DOCUMENT_TYPE_META[doc.type];
                        const statusMeta = DOCUMENT_STATUS_META[doc.status];
                        const c = doc.content ?? {};
                        const amount = doc.type === 'estimate' ? (c.total ?? null) : (c.total_amount ?? null);
                        const docPt = c.payment_type ?? null;
                        const months = doc.type === 'estimate' ? (c.payment_months ?? null) : (c.contract_months ?? null);
                        return (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => {
                              // 문서 정보로 자동 입력
                              if (docPt && PAYMENT_TYPES.includes(docPt)) setPaymentType(docPt as PaymentType);
                              if (amount != null) {
                                if (doc.type === 'contract' && c.monthly_amount && (docPt === 'monthly' || docPt === 'deposit')) {
                                  // 계약서 월결제/선수금은 월 금액 기준
                                  setPaymentAmount(String(c.monthly_amount));
                                } else {
                                  setPaymentAmount(String(amount));
                                }
                              }
                              if (months != null && months > 0) setPaymentMonths(String(months));
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 12px', borderRadius: 8,
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-bg)',
                              cursor: 'pointer', textAlign: 'left',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#d97706'; e.currentTarget.style.background = '#fffbeb'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-bg)'; }}
                          >
                            <div style={{
                              width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                              background: doc.type === 'estimate' ? '#eff6ff' : '#f5f3ff',
                              color: doc.type === 'estimate' ? '#3b82f6' : '#8b5cf6',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700,
                            }}>
                              {doc.type === 'estimate' ? '견' : '계'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {doc.title || typeMeta.label}
                              </div>
                              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
                                <span style={{
                                  padding: '1px 5px', borderRadius: 3, fontSize: 10,
                                  background: statusMeta.color === 'green' ? '#dcfce7'
                                    : statusMeta.color === 'yellow' ? '#fef9c3'
                                    : statusMeta.color === 'blue' ? '#dbeafe'
                                    : statusMeta.color === 'red' ? '#fee2e2'
                                    : '#f3f4f6',
                                  color: statusMeta.color === 'green' ? '#16a34a'
                                    : statusMeta.color === 'yellow' ? '#ca8a04'
                                    : statusMeta.color === 'blue' ? '#2563eb'
                                    : statusMeta.color === 'red' ? '#dc2626'
                                    : '#6b7280',
                                }}>
                                  {statusMeta.label}
                                </span>
                                {amount != null && <span>{formatCurrency(amount)}</span>}
                                {docPt && <span>{PAYMENT_TYPE_META[docPt as PaymentType]?.label ?? docPt}</span>}
                                {months != null && months > 0 && <span>{months}개월</span>}
                              </div>
                            </div>
                            <div style={{ fontSize: 11, color: '#d97706', fontWeight: 500, flexShrink: 0 }}>적용</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* 결제 유형 선택 */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, display: 'block' }}>
                  결제 유형
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {PAYMENT_TYPES.map((pt) => {
                    const meta = PAYMENT_TYPE_META[pt];
                    const isActive = paymentType === pt;
                    return (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setPaymentType(pt)}
                        style={{
                          flex: 1, padding: '10px 8px', borderRadius: 8,
                          border: isActive ? '2px solid #d97706' : '1px solid var(--color-border)',
                          background: isActive ? '#fffbeb' : 'var(--color-bg)',
                          cursor: 'pointer', textAlign: 'center',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#d97706' : 'var(--color-text-primary)' }}>
                          {meta.label}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {meta.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 입금 금액 입력 */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, display: 'block' }}>
                  {paymentType === 'deposit' ? '선수금 총액 (원)'
                    : paymentType === 'monthly' ? '월 납부 금액 (원)'
                    : '결제 금액 (원)'}
                </label>
                <input
                  className="form-input"
                  type="text"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="금액을 입력하세요"
                  autoFocus
                  style={{ width: '100%', fontSize: 14, padding: '10px 12px', borderRadius: 6 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && paymentAmount.trim()) handlePaymentConfirm();
                  }}
                />
                {paymentAmount && !isNaN(Number(paymentAmount)) && Number(paymentAmount) > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {formatCurrency(Number(paymentAmount))}
                  </div>
                )}
              </div>

              {/* 개월 수 입력 (선수금 / 월결제) */}
              {(paymentType === 'deposit' || paymentType === 'monthly') && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, display: 'block' }}>
                    {paymentType === 'deposit' ? '해당 금액은 몇 개월 치 인가요?' : '몇 개월에 걸쳐 납부 예정인가요?'}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      value={paymentMonths}
                      onChange={(e) => setPaymentMonths(e.target.value.replace(/[^0-9]/g, ''))}
                      style={{ width: 100, fontSize: 14, padding: '10px 12px', borderRadius: 6 }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>개월</span>
                  </div>
                  {paymentAmount && Number(paymentAmount) > 0 && Number(paymentMonths) > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6, padding: '8px 10px', background: 'var(--color-bg)', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                      {paymentType === 'deposit'
                        ? <>선수금 {formatCurrency(Number(paymentAmount))} · {paymentMonths}개월 분 (월 {formatCurrency(Math.round(Number(paymentAmount) / Number(paymentMonths)))})</>
                        : <>월 {formatCurrency(Number(paymentAmount))} × {paymentMonths}개월 = 총 {formatCurrency(Number(paymentAmount) * Number(paymentMonths))}</>}
                    </div>
                  )}
                </div>
              )}

              {/* 버튼 */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-md btn-secondary"
                  onClick={() => setPaymentModal(false)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn btn-md btn-primary"
                  disabled={!paymentAmount.trim() || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0
                    || ((paymentType === 'deposit' || paymentType === 'monthly') && (!paymentMonths || Number(paymentMonths) < 1))}
                  onClick={handlePaymentConfirm}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 종료 사유 모달 ── */}
      {closingModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)',
          }}
          onClick={() => { setClosingModal(null); setClosingReason(''); }}
        >
          <div
            style={{
              width: 440, maxWidth: 'calc(100vw - 32px)',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)', boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '20px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#dc2626', flexShrink: 0,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                    {PROJECT_STATUS_META[closingModal.toStatus]?.label ?? '종료'}(으)로 변경
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                    종료 사유를 입력해 주세요. 활동 로그에 기록됩니다.
                  </p>
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 24px 20px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {[
                  '프로젝트 정상 완료',
                  '고객 요청으로 종료',
                  '계약 불발',
                  '예산 부족',
                  '경쟁사 선정',
                  '연락 두절',
                  '일정 불일치',
                  '내부 사정으로 종료',
                ].map((preset) => {
                  const active = closingReason.trim() === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setClosingReason(preset);
                        closingReasonRef.current?.focus();
                      }}
                      style={{
                        fontSize: 12,
                        padding: '5px 10px',
                        borderRadius: 999,
                        border: `1px solid ${active ? '#dc2626' : 'var(--color-border)'}`,
                        background: active ? '#fef2f2' : 'var(--color-surface)',
                        color: active ? '#dc2626' : 'var(--color-text-primary)',
                        cursor: 'pointer',
                        lineHeight: 1.2,
                        transition: 'all 0.12s',
                      }}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
              <textarea
                ref={closingReasonRef}
                className="form-input"
                rows={4}
                value={closingReason}
                onChange={(e) => setClosingReason(e.target.value)}
                placeholder="위 항목을 클릭하거나 직접 입력해 주세요"
                autoFocus
                style={{
                  width: '100%', fontSize: 13, resize: 'vertical',
                  borderRadius: 6, padding: '10px 12px',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && closingReason.trim()) {
                    handleClosingConfirm();
                  }
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-md btn-secondary"
                  onClick={() => { setClosingModal(null); setClosingReason(''); }}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn btn-md btn-danger"
                  disabled={!closingReason.trim()}
                  onClick={handleClosingConfirm}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}