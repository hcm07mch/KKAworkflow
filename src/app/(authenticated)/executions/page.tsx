'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { LuRocket, LuExternalLink } from 'react-icons/lu';
import { StatusBadge, useFeedback } from '@/components/ui';
import { useProjectAssignees } from '@/components/hooks/use-project-assignees';
import type { DocumentStatus, PreReportContent } from '@/lib/domain/types';
import { CampaignPlanEditor } from './campaign-plan-editor';
import panel from '../panel-layout.module.css';

// ── Types ────────────────────────────────────────────────

interface ExecItem {
  id: string;
  projectId: string;
  projectTitle: string;
  clientName: string;
  ownerId: string;
  ownerName: string;
  docStatus: DocumentStatus;
  totalMonthly: number;
  createdAt: string;
  flowNumber: number | null;
  content: PreReportContent;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
}

type RightPanelMode = 'empty' | 'edit';

// ── Page ─────────────────────────────────────────────────

export default function ExecutionsPage() {
  return (
    <Suspense>
      <ExecutionsContent />
    </Suspense>
  );
}

function ExecutionsContent() {
  const searchParams = useSearchParams();
  const { toast, confirm } = useFeedback();
  const [executions, setExecutions] = useState<ExecItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('executions_ownerFilter') ?? 'all';
    }
    return 'all';
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<RightPanelMode>('empty');

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((u) => setCurrentUserId(u.id ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/documents?type=pre_report')
      .then((r) => r.json())
      .then((docs: any[]) => {
        const items: ExecItem[] = docs.map((d) => {
          const content: PreReportContent = d.content ?? {};
          return {
            id: d.id,
            projectId: d.project?.id ?? '',
            projectTitle: d.project?.title ?? '',
            clientName: d.project?.client?.name ?? '',
            ownerId: d.project?.owner?.id ?? '',
            ownerName: d.project?.owner?.name ?? '-',
            docStatus: d.status,
            totalMonthly: content.total_monthly ?? 0,
            createdAt: d.created_at,
            flowNumber: d.segment?.flow_number ?? d.content?.flow_number ?? null,
            content,
          };
        });
        setExecutions(items);
        setLoading(false);
        const savedId = searchParams.get('selected') ?? localStorage.getItem('executions_selectedId');
        if (savedId) {
          const target = items.find((ex) => ex.id === savedId);
          if (target) { setSelectedId(target.id); setPanelMode('edit'); }
        }
      })
      .catch(() => setLoading(false));
  }, []);

  // 동일 프로젝트 여러 건 존재 시 flow_number 표시
  const projectHasSiblings = new Set<string>();
  (() => {
    const cnt: Record<string, number> = {};
    for (const ex of executions) cnt[ex.projectId] = (cnt[ex.projectId] ?? 0) + 1;
    for (const pid of Object.keys(cnt)) { if (cnt[pid] > 1) projectHasSiblings.add(pid); }
  })();

  const getFlowSuffix = (e: ExecItem) => {
    if (!projectHasSiblings.has(e.projectId)) return '';
    const fn = e.flowNumber;
    return fn != null && fn >= 1 ? ` #${fn}` : '';
  };

  const ownerNames = Array.from(new Set(executions.map((ex) => ex.ownerName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));

  const filtered = executions.filter((ex) => {
    if (filter !== 'all' && ex.docStatus !== filter) return false;
    if (ownerFilter !== 'all' && ex.ownerName !== ownerFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return ex.projectTitle.toLowerCase().includes(q) || ex.clientName.toLowerCase().includes(q);
    }
    return true;
  });

  const selected = selectedId ? executions.find((e) => e.id === selectedId) ?? null : null;

  // 선택된 집행 프로젝트의 담당자 권한
  const { isAssignee } = useProjectAssignees(
    selected?.projectId ?? null,
    currentUserId,
    selected?.ownerId ?? null,
  );
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

  // ── Handlers ──

  const handleSelect = useCallback((item: ExecItem) => {
    setSelectedId(item.id);
    setPanelMode('edit');
    localStorage.setItem('executions_selectedId', item.id);
  }, []);

  const handleCancel = useCallback(() => {
    setSelectedId(null);
    setPanelMode('empty');
  }, []);

  const handleSaveEdit = useCallback(
    async (data: PreReportContent) => {
      if (!selectedId) return;

      try {
        const res = await fetch(`/api/documents/${selectedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: data }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast({ title: err?.error?.message || '저장에 실패했습니다', variant: 'error' });
          return;
        }
      } catch {
        toast({ title: '저장 중 오류가 발생했습니다', variant: 'error' });
        return;
      }

      setExecutions((prev) =>
        prev.map((e) =>
          e.id === selectedId
            ? { ...e, clientName: data.recipient ?? e.clientName, totalMonthly: data.total_monthly ?? e.totalMonthly, content: data }
            : e,
        ),
      );
      toast({ title: '진행안이 수정되었습니다', variant: 'success' });
    },
    [selectedId, toast],
  );

  const handleSubmit = useCallback(
    async (data: PreReportContent) => {
      if (!selectedId) return;

      const ok = await confirm({
        title: '진행안을 제출하시겠습니까?',
        description: '프로젝트가 사전보고 승인 단계로 이동합니다.',
        variant: 'info',
        confirmLabel: '제출',
        cancelLabel: '취소',
      });
      if (!ok) return;

      try {
        await fetch(`/api/documents/${selectedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: data }),
        });
      } catch { /* 제출 계속 진행 */ }

      try {
        const res = await fetch(`/api/documents/${selectedId}/submit`, { method: 'POST' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast({ title: err?.error?.message || '진행안 제출에 실패했습니다', variant: 'error' });
          return;
        }

        setExecutions((prev) =>
          prev.map((e) =>
            e.id === selectedId
              ? { ...e, docStatus: 'in_review' as DocumentStatus, content: data }
              : e,
          ),
        );
        toast({ title: '진행안이 제출되었습니다', variant: 'success' });

        fetch(`/api/documents/${selectedId}/pdf/generate`, { method: 'POST' }).catch(() => {});
      } catch {
        toast({ title: '진행안 제출 중 오류가 발생했습니다', variant: 'error' });
      }
    },
    [selectedId, confirm, toast],
  );

  const handleRedraft = useCallback(
    async () => {
      if (!selectedId) return;

      const ok = await confirm({
        title: '진행안을 재작성하시겠습니까?',
        description: '진행안이 작성중 상태로 돌아가며 다시 수정할 수 있습니다.',
        variant: 'warning',
        confirmLabel: '재작성',
        cancelLabel: '취소',
      });
      if (!ok) return;

      try {
        const res = await fetch(`/api/documents/${selectedId}/redraft`, { method: 'POST' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast({ title: err?.error?.message || '재작성 전환에 실패했습니다', variant: 'error' });
          return;
        }

        setExecutions((prev) =>
          prev.map((e) =>
            e.id === selectedId ? { ...e, docStatus: 'draft' as DocumentStatus } : e,
          ),
        );
        toast({ title: '진행안이 재작성 상태로 전환되었습니다', variant: 'success' });
      } catch {
        toast({ title: '재작성 전환 중 오류가 발생했습니다', variant: 'error' });
      }
    },
    [selectedId, confirm, toast],
  );

  const handleStatusChange = useCallback(
    (newStatus: string) => {
      if (!selectedId) return;
      setExecutions((prev) =>
        prev.map((e) =>
          e.id === selectedId ? { ...e, docStatus: newStatus as DocumentStatus } : e,
        ),
      );
    },
    [selectedId],
  );

  function isActive(id: string) {
    return panelMode === 'edit' && selectedId === id;
  }

  // ── Loading skeleton ──

  if (loading) {
    return (
      <div className={panel.wrapper}>
        <div className={panel.leftPanel}>
          <div className={panel.leftHeader}>
            <span className={panel.leftTitle}>집행 관리</span>
            <div className={panel.searchInput} style={{ opacity: 0.5 }} />
          </div>
          <div className={panel.itemList}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={panel.skeletonItem}>
                <div className={panel.skeletonBar} style={{ width: '65%' }} />
                <div className={panel.skeletonBar} style={{ width: '40%', height: 8 }} />
              </div>
            ))}
          </div>
        </div>
        <div className={panel.rightPanel}>
          <div className={panel.emptyState}>
            <span className={panel.emptyIcon}><LuRocket size={32} /></span>
            <span>프로젝트를 선택하세요</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={panel.wrapper}>
      {/* ══════════ Left Panel ══════════ */}
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <div className={panel.leftTitleRow}>
            <span className={panel.leftTitle}>집행 관리</span>
            <select
              className={panel.sortSelect}
              value={ownerFilter}
              onChange={(e) => {
                const v = e.target.value;
                setOwnerFilter(v);
                localStorage.setItem('executions_ownerFilter', v);
              }}
            >
              <option value="all">담당자: 전체</option>
              {ownerNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <input className={panel.searchInput} placeholder="프로젝트, 고객사 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className={panel.filterTabs}>
            <button type="button" className={`${panel.filterTab} ${filter === 'all' ? panel.filterTabActive : ''}`} onClick={() => setFilter('all')}>전체</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'draft' ? panel.filterTabActive : ''}`} onClick={() => setFilter('draft')}>작성</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'in_review' ? panel.filterTabActive : ''}`} onClick={() => setFilter('in_review')}>검토</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'approved' ? panel.filterTabActive : ''}`} onClick={() => setFilter('approved')}>승인</button>
          </div>
        </div>
        <div className={panel.itemList}>
          {filtered.map((ex) => {
            const suffix = getFlowSuffix(ex);
            return (
              <div key={ex.id} className={`${panel.item} ${isActive(ex.id) ? panel.itemActive : ''}`} onClick={() => handleSelect(ex)}>
                <span className={panel.itemNameRow}>
                  <span className={panel.itemName}>{ex.projectTitle}{suffix}</span>
                  <a
                    href={`/projects?selected=${ex.projectId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={panel.itemProjectLink}
                    onClick={(ev) => ev.stopPropagation()}
                    title="프로젝트 보기"
                  >
                    <LuExternalLink size={12} />
                  </a>
                </span>
                <span className={panel.itemMeta}>
                  <span>{ex.ownerName}</span>
                  <span>·</span>
                  <span>{ex.clientName}</span>
                  <span>·</span>
                  <StatusBadge status={ex.docStatus} type="document" />
                </span>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>집행 건이 없습니다.</div>
          )}
        </div>
        <div className={panel.leftFooter}>{filtered.length}건</div>
      </div>

      {/* ══════════ Right Panel ══════════ */}
      <div className={panel.rightPanel} style={{ padding: panelMode !== 'empty' ? 0 : undefined }}>
        {panelMode === 'empty' && (
          <div className={panel.emptyState}>
            <span className={panel.emptyIcon}><LuRocket size={32} /></span>
            <span>집행 건을 선택하세요</span>
          </div>
        )}

        {panelMode === 'edit' && selected && (
          <CampaignPlanEditor
            key={selected.id}
            mode="edit"
            initialData={{
              ...selected.content,
              project_name: selected.content.project_name || selected.projectTitle,
              recipient: selected.content.recipient || selected.clientName,
            }}
            documentId={selected.id}
            defaultClientName={selected.clientName}
            defaultProjectName={selected.projectTitle}
            readOnly={selected.docStatus !== 'draft'}
            documentStatus={selected.docStatus}
            onSave={(data) => { if (ensureAssignee()) handleSaveEdit(data); }}
            onSubmit={(data) => { if (ensureAssignee()) handleSubmit(data); }}
            onRedraft={() => { if (ensureAssignee()) handleRedraft(); }}
            onStatusChange={handleStatusChange}
            onCancel={handleCancel}
          />
        )}
      </div>
    </div>
  );
}