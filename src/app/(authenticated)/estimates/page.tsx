'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { LuFileText, LuPlus, LuExternalLink } from 'react-icons/lu';
import { StatusBadge, useFeedback } from '@/components/ui';
import type { DocumentStatus, ServiceType, EstimateContent } from '@/lib/domain/types';
import { SERVICE_TYPE_META } from '@/lib/domain/types';
import { EstimateEditor } from './estimate-editor';
import panel from '../panel-layout.module.css';

// ── Types ────────────────────────────────────────────────

interface EstimateListItem {
  id: string;
  projectId: string;
  projectTitle: string;
  clientId: string;
  clientName: string;
  ownerId: string;
  ownerName: string;
  serviceType: ServiceType;
  status: DocumentStatus;
  amount: number;
  createdAt: string;
  sentAt: string | null;
  projectStartDate: string | null;
  projectEndDate: string | null;
  content: EstimateContent;
}

type RightPanelMode = 'empty' | 'new' | 'edit';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
}

// ── Page ─────────────────────────────────────────────────

export default function EstimatesPage() {
  const searchParams = useSearchParams();
  const { toast, confirm } = useFeedback();
  const [estimates, setEstimates] = useState<EstimateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('estimates_ownerFilter') ?? 'all';
    }
    return 'all';
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<RightPanelMode>('empty');

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((u) => setCurrentUserId(u.id ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/documents?type=estimate')
      .then((r) => r.json())
      .then((docs: any[]) => {
        const items: EstimateListItem[] = docs.map((d) => {
          const content: EstimateContent = d.content ?? {};
          const amount = content.total ?? content.subtotal ?? d.project?.total_amount ?? 0;
          return {
            id: d.id,
            projectId: d.project?.id ?? '',
            projectTitle: d.project?.title ?? '',
            clientId: d.project?.client?.id ?? '',
            clientName: d.project?.client?.name ?? '',
            ownerId: d.project?.owner?.id ?? '',
            ownerName: d.project?.owner?.name ?? '-',
            serviceType: d.project?.service_type ?? 'viral',
            status: d.status,
            amount,
            createdAt: d.created_at,
            sentAt: d.sent_at,
            projectStartDate: d.project?.start_date ?? null,
            projectEndDate: d.project?.end_date ?? null,
            content,
          };
        });
        setEstimates(items);
        setLoading(false);
        const savedId = searchParams.get('selected') ?? localStorage.getItem('estimates_selectedId');
        if (savedId) {
          const target = items.find((e) => e.id === savedId);
          if (target) { setSelectedId(target.id); setPanelMode('edit'); }
        }
      })
      .catch(() => setLoading(false));
  }, []);

  // flow_number 기반 넘버링 (동일 프로젝트 여러 건 존재 시만 표시)
  const projectHasSiblings = new Set<string>();
  (() => {
    const cnt: Record<string, number> = {};
    for (const e of estimates) cnt[e.projectId] = (cnt[e.projectId] ?? 0) + 1;
    for (const pid of Object.keys(cnt)) { if (cnt[pid] > 1) projectHasSiblings.add(pid); }
  })();
  const getFlowSuffix = (e: EstimateListItem) => {
    if (!projectHasSiblings.has(e.projectId)) return '';
    const fn = (e.content as Record<string, any>)?.flow_number;
    return fn >= 1 ? ` #${fn}` : '';
  };

  const ownerNames = Array.from(new Set(estimates.map((e) => e.ownerName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));

  const filtered = estimates.filter((e) => {
    if (ownerFilter !== 'all' && e.ownerName !== ownerFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return e.projectTitle.toLowerCase().includes(q) || e.clientName.toLowerCase().includes(q);
  });

  const selected = selectedId ? estimates.find((e) => e.id === selectedId) ?? null : null;

  // ── Handlers ──

  const handleNew = useCallback(() => {
    setSelectedId(null);
    setPanelMode('new');
  }, []);

  const handleSelect = useCallback((item: EstimateListItem) => {
    setSelectedId(item.id);
    setPanelMode('edit');
    localStorage.setItem('estimates_selectedId', item.id);
  }, []);

  const handleCancel = useCallback(() => {
    setSelectedId(null);
    setPanelMode('empty');
  }, []);

  const handleSaveNew = useCallback((data: EstimateContent) => {
    // TODO: POST /api/documents → 실제 API 연결
    const fakeId = `est_${Date.now()}`;
    const newItem: EstimateListItem = {
      id: fakeId,
      projectTitle: data.project_name ?? '',
      clientId: '',
      clientName: data.recipient?.replace(' 귀하', '') ?? '',
      ownerName: '-',
      serviceType: 'viral',
      status: 'draft',
      amount: data.total ?? 0,
      createdAt: new Date().toISOString(),
      sentAt: null,
      projectStartDate: null,
      projectEndDate: null,
      content: data,
    };
    setEstimates((prev) => [newItem, ...prev]);
    setSelectedId(fakeId);
    setPanelMode('edit');
    toast({ title: '견적서가 저장되었습니다', variant: 'success' });
  }, [toast]);

  const handleSaveEdit = useCallback(
    async (data: EstimateContent) => {
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

      setEstimates((prev) =>
        prev.map((e) =>
          e.id === selectedId
            ? {
                ...e,
                projectTitle: data.project_name ?? e.projectTitle,
                clientName: data.recipient?.replace(' 귀하', '') ?? e.clientName,
                amount: data.total ?? e.amount,
                content: data,
              }
            : e,
        ),
      );
      toast({ title: '견적서가 수정되었습니다', variant: 'success' });
    },
    [selectedId, toast],
  );

  const handleSubmit = useCallback(
    async (data: EstimateContent) => {
      if (!selectedId) return;

      const ok = await confirm({
        title: '견적서를 제출하시겠습니까?',
        description: '프로젝트가 견적 승인 단계로 이동합니다.',
        variant: 'info',
        confirmLabel: '제출',
        cancelLabel: '취소',
      });
      if (!ok) return;

      // API: 견적서 내용 먼저 저장 (draft 상태에서만 가능)
      try {
        await fetch(`/api/documents/${selectedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: data }),
        });
      } catch { /* 제출 자체는 계속 진행 */ }

      // API: 견적서 제출 → 문서 상태 in_review + 프로젝트 상태 B2_estimate_review
      try {
        const res = await fetch(`/api/documents/${selectedId}/submit`, {
          method: 'POST',
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast({ title: err?.error?.message || '견적서 제출에 실패했습니다', variant: 'error' });
          return;
        }

        // UI 업데이트
        setEstimates((prev) =>
          prev.map((e) =>
            e.id === selectedId
              ? { ...e, status: 'in_review' as DocumentStatus, content: data }
              : e,
          ),
        );
        toast({ title: '견적서가 제출되었습니다', message: '프로젝트가 견적 승인 단계로 이동합니다.', variant: 'success' });

        // 서버 사이드 PDF 생성 (비동기 — UI 차단 없음)
        fetch(`/api/documents/${selectedId}/pdf/generate`, { method: 'POST' }).catch(() => {});
      } catch {
        toast({ title: '견적서 제출 중 오류가 발생했습니다', variant: 'error' });
      }
    },
    [selectedId, confirm, toast],
  );

  const handleRedraft = useCallback(
    async () => {
      if (!selectedId) return;

      const ok = await confirm({
        title: '견적서를 재작성하시겠습니까?',
        description: '견적서가 작성중 상태로 돌아가며 다시 수정할 수 있습니다.',
        variant: 'warning',
        confirmLabel: '재작성',
        cancelLabel: '취소',
      });
      if (!ok) return;

      try {
        const res = await fetch(`/api/documents/${selectedId}/redraft`, {
          method: 'POST',
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast({ title: err?.error?.message || '재작성 전환에 실패했습니다', variant: 'error' });
          return;
        }

        setEstimates((prev) =>
          prev.map((e) =>
            e.id === selectedId
              ? { ...e, status: 'draft' as DocumentStatus }
              : e,
          ),
        );
        toast({ title: '견적서가 재작성 상태로 전환되었습니다', variant: 'success' });
      } catch {
        toast({ title: '재작성 전환 중 오류가 발생했습니다', variant: 'error' });
      }
    },
    [selectedId, confirm, toast],
  );

  const handleStatusChange = useCallback(
    (newStatus: string) => {
      if (!selectedId) return;
      setEstimates((prev) =>
        prev.map((e) =>
          e.id === selectedId ? { ...e, status: newStatus as DocumentStatus } : e,
        ),
      );
    },
    [selectedId],
  );

  // ── Left panel item active check ──

  function isActive(id: string) {
    return panelMode === 'edit' && selectedId === id;
  }

  // ── Render ──

  return (
    <div className={panel.wrapper}>
      {/* ══════════ Left Panel ══════════ */}
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <div className={panel.leftTitleRow}>
            <span className={panel.leftTitle}>견적서</span>
            <select
              className={panel.sortSelect}
              value={ownerFilter}
              onChange={(e) => {
                const v = e.target.value;
                setOwnerFilter(v);
                localStorage.setItem('estimates_ownerFilter', v);
              }}
            >
              <option value="all">담당자: 전체</option>
              {ownerNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <input
            className={panel.searchInput}
            placeholder="프로젝트, 고객사 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={panel.itemList}>
          <div
            className={`${panel.addItem} ${panelMode === 'new' ? panel.itemActive : ''}`}
            onClick={handleNew}
          >
            <LuPlus size={14} /> 새 견적서
          </div>

          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={panel.skeletonItem}>
                  <div className={panel.skeletonBar} style={{ width: '55%' }} />
                  <div className={panel.skeletonBar} style={{ width: '35%', height: 8 }} />
                </div>
              ))
            : filtered.map((e) => {
                const suffix = getFlowSuffix(e);
                return (
                <div
                  key={e.id}
                  className={`${panel.item} ${isActive(e.id) ? panel.itemActive : ''}`}
                  onClick={() => handleSelect(e)}
                >
                  <span className={panel.itemNameRow}>
                    <span className={panel.itemName}>{e.clientName || e.content?.recipient || '(미지정)'}{suffix}</span>
                    {e.projectId && (
                      <a
                        href={`/projects?selected=${e.projectId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={panel.itemProjectLink}
                        onClick={(ev) => ev.stopPropagation()}
                        title="프로젝트 보기"
                      >
                        <LuExternalLink size={12} />
                      </a>
                    )}
                  </span>
                  <span className={panel.itemMeta}>
                    <span>{e.ownerName}</span>
                    <span>·</span>
                    <span>{formatCurrency(e.amount)}</span>
                    <span>·</span>
                    <StatusBadge status={e.status} type="document" />
                  </span>
                </div>
              ); })}

          {!loading && filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              견적서가 없습니다.
            </div>
          )}
        </div>
        <div className={panel.leftFooter}>{loading ? '-' : `${filtered.length}건`}</div>
      </div>

      {/* ══════════ Right Panel ══════════ */}
      <div className={panel.rightPanel} style={{ padding: panelMode !== 'empty' ? 0 : undefined }}>
        {panelMode === 'empty' && (
          <div className={panel.emptyState}>
            <span className={panel.emptyIcon}><LuFileText size={32} /></span>
            <span>견적서를 선택하거나 새로 작성하세요</span>
          </div>
        )}

        {panelMode === 'new' && (
          <EstimateEditor
            key="new"
            mode="new"
            onSave={handleSaveNew}
            onCancel={handleCancel}
          />
        )}

        {panelMode === 'edit' && selected && (
          <EstimateEditor
            key={selected.id}
            mode="edit"
            initialData={{
              ...selected.content,
              project_name: selected.content.project_name || selected.projectTitle,
              recipient: selected.content.recipient || (selected.clientName ? `${selected.clientName} 귀하` : ''),
              contract_period: selected.content.contract_period || (
                selected.projectStartDate && selected.projectEndDate
                  ? `${selected.projectStartDate} ~ ${selected.projectEndDate}`
                  : selected.projectStartDate
                    ? `${selected.projectStartDate} ~`
                    : undefined
              ),
            }}
            defaultClientId={selected.clientId}
            documentId={selected.id}
            readOnly={selected.status !== 'draft' || !currentUserId || selected.ownerId !== currentUserId}
            documentStatus={selected.status}
            onSave={currentUserId && selected.ownerId === currentUserId ? handleSaveEdit : undefined}
            onSubmit={currentUserId && selected.ownerId === currentUserId ? handleSubmit : undefined}
            onRedraft={currentUserId && selected.ownerId === currentUserId ? handleRedraft : undefined}
            onStatusChange={handleStatusChange}
            onCancel={handleCancel}
          />
        )}
      </div>
    </div>
  );
}