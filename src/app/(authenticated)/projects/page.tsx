'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LuFolderOpen, LuPlus, LuPanelLeftOpen, LuPanelLeftClose, LuDownload, LuPencil, LuX, LuCheck } from 'react-icons/lu';
import { StatusBadge, ActionButton } from '@/components/ui';
import type { ProjectStatus, ServiceType, PaymentType, DocumentStatus, DocumentType } from '@/lib/domain/types';
import {
  PROJECT_STATUS_META, PROJECT_STATUS_GROUPS, PROJECT_STATUS_TRANSITIONS,
  SERVICE_TYPE_META, SERVICE_TYPES, PAYMENT_TYPE_META, PAYMENT_TYPES,
  DOCUMENT_TYPE_META,
} from '@/lib/domain/types';
import { WorkflowProgress, WorkflowBuilder } from './[id]/components';
import panel from '../panel-layout.module.css';

/** metadata.workflow_stack이 없을 때 현재 status에서 스택 추론 */
function inferStackFromStatus(currentStatus: ProjectStatus): string[] {
  const allStatuses = Object.keys(PROJECT_STATUS_META) as ProjectStatus[];
  const currentIdx = allStatuses.indexOf(currentStatus);
  const keys: string[] = [];
  for (const group of PROJECT_STATUS_GROUPS) {
    const hasRelevant = group.statuses.some((s) => allStatuses.indexOf(s) <= currentIdx);
    if (hasRelevant) keys.push(group.key);
  }
  return keys;
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
  const searchParams = useSearchParams();
  const router = useRouter();
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
    fetch(`/api/projects/${p.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error();
        setDetail(data);
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, []);

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

  function handleTransition(toStatus: ProjectStatus) {
    if (!detail || !selected) return;
    // F 그룹(종료) 전환 시 종료 사유 모달 표시
    if (toStatus === 'F1_refund' || toStatus === 'F2_closed') {
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

  function handleWorkflowAdd(groupKey: string, paymentAmount?: number) {
    if (!detail || !selected) return;
    // F 그룹(종료) 추가 시 종료 사유 모달 표시
    if (groupKey === 'F') {
      const group = PROJECT_STATUS_GROUPS.find((g) => g.key === 'F');
      const toStatus = (group?.statuses[0] ?? 'F1_refund') as ProjectStatus;
      setClosingReason('');
      setClosingModal({ toStatus, source: 'workflowAdd', groupKey: 'F' });
      return;
    }
    const saved: string[] | undefined = detail.metadata?.workflow_stack as string[] | undefined;
    const currentStack = saved && saved.length > 0 ? saved : inferStackFromStatus(selected.status);
    const newStack = [...currentStack, groupKey];
    const group = PROJECT_STATUS_GROUPS.find((g) => g.key === groupKey);
    // D 그룹: D1(입금 대기) 자동 완료 → D2 로 시작
    const newStatus = groupKey === 'D'
      ? 'D2_payment_confirmed' as ProjectStatus
      : (group?.statuses[0] ?? selected.status) as ProjectStatus;
    // 낙관적 업데이트
    const newMeta = { ...detail.metadata, workflow_stack: newStack };
    const newAmount = groupKey === 'D' && paymentAmount != null ? paymentAmount : selected.totalAmount;
    setDetail((prev) => prev ? { ...prev, status: newStatus, metadata: newMeta, total_amount: newAmount } : prev);
    setSelected((prev) => prev ? { ...prev, status: newStatus, totalAmount: newAmount } : prev);
    setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: newStatus, totalAmount: newAmount } : p));
    const patchBody: Record<string, any> = { status: newStatus, metadata: newMeta };
    if (groupKey === 'D' && paymentAmount != null) {
      patchBody.total_amount = paymentAmount;
    }
    fetch(`/api/projects/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
    }).catch(() => {
      // 실패 시 롤백
      setDetail((prev) => prev ? { ...prev, status: selected.status, metadata: detail.metadata, total_amount: selected.totalAmount } : prev);
      setSelected((prev) => prev ? { ...prev, status: selected.status, totalAmount: selected.totalAmount } : prev);
      setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: selected.status, totalAmount: selected.totalAmount } : p));
      alert('상태 변경에 실패했습니다.');
    });
  }

  function handleWorkflowDelete(index: number) {
    if (!detail || !selected) return;
    const saved: string[] | undefined = detail.metadata?.workflow_stack as string[] | undefined;
    const currentStack = saved && saved.length > 0 ? saved : inferStackFromStatus(selected.status);
    const newStack = currentStack.filter((_, i) => i !== index);
    let newStatus: ProjectStatus = 'A_sales';
    if (newStack.length > 0) {
      const lastKey = newStack[newStack.length - 1];
      const group = PROJECT_STATUS_GROUPS.find((g) => g.key === lastKey);
      if (group) newStatus = group.statuses[0];
    }
    // 낙관적 업데이트
    const newMeta = { ...detail.metadata, workflow_stack: newStack };
    setDetail((prev) => prev ? { ...prev, status: newStatus, metadata: newMeta } : prev);
    setSelected((prev) => prev ? { ...prev, status: newStatus } : prev);
    setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: newStatus } : p));
    fetch(`/api/projects/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, metadata: newMeta }),
    }).catch(() => {
      setDetail((prev) => prev ? { ...prev, status: selected.status, metadata: detail.metadata } : prev);
      setSelected((prev) => prev ? { ...prev, status: selected.status } : prev);
      setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: selected.status } : p));
      alert('상태 변경에 실패했습니다.');
    });
  }

  function handleWorkflowStatusChange(toStatus: ProjectStatus) {
    if (!detail || !selected) return;
    // F 그룹(종료) 상태 변경 시 종료 사유 모달 표시
    if (toStatus === 'F1_refund' || toStatus === 'F2_closed') {
      setClosingReason('');
      setClosingModal({ toStatus, source: 'workflowStatus' });
      return;
    }
    const prevStatus = selected.status;
    // 낙관적 업데이트
    setDetail((prev) => prev ? { ...prev, status: toStatus } : prev);
    setSelected((prev) => prev ? { ...prev, status: toStatus } : prev);
    setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: toStatus } : p));
    fetch(`/api/projects/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: toStatus }),
    }).catch(() => {
      setDetail((prev) => prev ? { ...prev, status: prevStatus } : prev);
      setSelected((prev) => prev ? { ...prev, status: prevStatus } : prev);
      setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: prevStatus } : p));
      alert('상태 변경에 실패했습니다.');
    });
  }

  // 종료 사유 모달 확인 핸들러
  function handleClosingConfirm() {
    if (!closingModal || !detail || !selected) return;
    const { toStatus, source, groupKey } = closingModal;
    const reason = closingReason.trim();

    if (source === 'workflowAdd' && groupKey) {
      // 워크플로우에 F 그룹 추가
      const saved: string[] | undefined = detail.metadata?.workflow_stack as string[] | undefined;
      const currentStack = saved && saved.length > 0 ? saved : inferStackFromStatus(selected.status);
      const newStack = [...currentStack, groupKey];
      const newMeta = { ...detail.metadata, workflow_stack: newStack };
      // 낙관적 업데이트
      setDetail((prev) => prev ? { ...prev, status: toStatus, metadata: newMeta } : prev);
      setSelected((prev) => prev ? { ...prev, status: toStatus } : prev);
      setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: toStatus } : p));
      // metadata 먼저 업데이트 후 transition (F 상태에서는 metadata 수정 불가하므로)
      fetch(`/api/projects/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: newMeta }),
      }).then((r) => {
        if (!r.ok) throw new Error();
        return fetch(`/api/projects/${detail.id}/transition`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: toStatus, reason: reason || undefined }),
        });
      }).then((r) => {
        if (!r.ok) throw new Error();
      }).catch(() => {
        setDetail((prev) => prev ? { ...prev, status: selected.status, metadata: detail.metadata } : prev);
        setSelected((prev) => prev ? { ...prev, status: selected.status } : prev);
        setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: selected.status } : p));
        alert('상태 변경에 실패했습니다.');
      });
    } else {
      // transition / workflowStatus: transition API로 사유 전달
      const prevStatus = selected.status;
      setDetail((prev) => prev ? { ...prev, status: toStatus } : prev);
      setSelected((prev) => prev ? { ...prev, status: toStatus } : prev);
      setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, status: toStatus } : p));
      fetch(`/api/projects/${detail.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: toStatus, reason: reason || undefined }),
      }).then((r) => {
        if (!r.ok) throw new Error();
        if (source === 'transition') selectProject({ ...selected, status: toStatus });
      }).catch(() => {
        setDetail((prev) => prev ? { ...prev, status: prevStatus } : prev);
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
              <Link href="/projects/new" className={panel.addItem}>
                <LuPlus size={14} /> 새 프로젝트
              </Link>
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className={`${panel.item} ${selected?.id === p.id ? panel.itemActive : ''}`}
                  onClick={() => selectProject(p)}
                >
                  <span className={panel.itemName}>{p.title}</span>
                  <span className={panel.itemMeta}>
                    <span>{p.clientName}</span>
                    <span>·</span>
                    <StatusBadge status={p.status} type="project" />
                  </span>
                </div>
              ))}
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
                {!editing && !['E4_execution', 'F1_refund', 'F2_closed'].includes(selected.status) && (
                  <ActionButton label="수정" variant="ghost-filled" size="sm" icon={<LuPencil size={13} />} onClick={startEdit} />
                )}
                {editing && (
                  <>
                    <ActionButton label="취소" variant="ghost" size="sm" icon={<LuX size={13} />} onClick={cancelEdit} disabled={saving} />
                    <ActionButton label={saving ? '저장 중...' : '저장'} variant="primary" size="sm" icon={<LuCheck size={13} />} onClick={saveEdit} disabled={saving} />
                  </>
                )}
              </div>
            </div>

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
                        <td><span className={panel.fieldValue}>{detail?.client?.name ?? selected.clientName}</span></td>
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
              <WorkflowBuilder
                serviceType={selected.serviceType}
                projectStatus={selected.status}
                workflowStack={(detail?.metadata?.workflow_stack as string[]) ?? []}
                manualStatuses={manualStatuses}
                onAdd={handleWorkflowAdd}
                onDelete={handleWorkflowDelete}
                onStatusChange={handleWorkflowStatusChange}
              />
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
                      {detail.documents.map((doc) => (
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 활동 로그 */}
            <div className={panel.detailSection}>
              <div className={panel.detailSectionTitle}>활동 로그</div>
              <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                최근 활동이 여기에 표시됩니다.
              </div>
            </div>
          </>
        )}
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
              <textarea
                ref={closingReasonRef}
                className="form-input"
                rows={4}
                value={closingReason}
                onChange={(e) => setClosingReason(e.target.value)}
                placeholder="예: 고객 요청으로 프로젝트 종료, 계약 불발 등"
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