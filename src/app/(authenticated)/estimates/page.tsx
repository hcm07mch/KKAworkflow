'use client';

import { useEffect, useState, useCallback } from 'react';
import { LuFileText, LuPlus } from 'react-icons/lu';
import { StatusBadge, useFeedback } from '@/components/ui';
import type { DocumentStatus, ServiceType, EstimateContent } from '@/lib/domain/types';
import { SERVICE_TYPE_META } from '@/lib/domain/types';
import { EstimateEditor } from './estimate-editor';
import panel from '../panel-layout.module.css';

// ── Types ────────────────────────────────────────────────

interface EstimateListItem {
  id: string;
  projectTitle: string;
  clientName: string;
  ownerName: string;
  serviceType: ServiceType;
  status: DocumentStatus;
  amount: number;
  createdAt: string;
  sentAt: string | null;
  content: EstimateContent;
}

type RightPanelMode = 'empty' | 'new' | 'edit';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
}

// ── Page ─────────────────────────────────────────────────

export default function EstimatesPage() {
  const { toast, confirm } = useFeedback();
  const [estimates, setEstimates] = useState<EstimateListItem[]>([]);
  const [loading, setLoading] = useState(true);
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
    fetch('/api/documents?type=estimate')
      .then((r) => r.json())
      .then((docs: any[]) => {
        const items: EstimateListItem[] = docs.map((d) => {
          const content: EstimateContent = d.content ?? {};
          const amount = content.total ?? content.subtotal ?? d.project?.total_amount ?? 0;
          return {
            id: d.id,
            projectTitle: d.project?.title ?? '',
            clientName: d.project?.client?.name ?? '',
            ownerName: d.project?.owner?.name ?? '-',
            serviceType: d.project?.service_type ?? 'viral',
            status: d.status,
            amount,
            createdAt: d.created_at,
            sentAt: d.sent_at,
            content,
          };
        });
        setEstimates(items);
        setLoading(false);
        const savedId = localStorage.getItem('estimates_selectedId');
        if (savedId) {
          const target = items.find((e) => e.id === savedId);
          if (target) { setSelectedId(target.id); setPanelMode('edit'); }
        }
      })
      .catch(() => setLoading(false));
  }, []);

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
      clientName: data.recipient?.replace(' 귀하', '') ?? '',
      ownerName: '-',
      serviceType: 'viral',
      status: 'draft',
      amount: data.total ?? 0,
      createdAt: new Date().toISOString(),
      sentAt: null,
      content: data,
    };
    setEstimates((prev) => [newItem, ...prev]);
    setSelectedId(fakeId);
    setPanelMode('edit');
    toast({ title: '견적서가 저장되었습니다', variant: 'success' });
  }, [toast]);

  const handleSaveEdit = useCallback(
    (data: EstimateContent) => {
      if (!selectedId) return;
      // TODO: PUT /api/documents/:id → 실제 API 연결
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
    async (data: EstimateContent, pdfBlob: Blob) => {
      if (!selectedId) return;

      const ok = await confirm({
        title: '견적서를 제출하시겠습니까?',
        description: 'PDF가 저장되고 프로젝트가 견적 승인 단계로 이동합니다.',
        variant: 'info',
        confirmLabel: '제출',
        cancelLabel: '취소',
      });
      if (!ok) return;

      const fileName = `견적서_${data.document_number || selectedId}.pdf`;

      // API: PDF 업로드 + 견적서 제출 → 문서 상태 in_review + 프로젝트 상태 B2_estimate_review
      try {
        const formData = new FormData();
        formData.append('pdf', new File([pdfBlob], fileName, { type: 'application/pdf' }));

        const res = await fetch(`/api/documents/${selectedId}/submit`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast({ title: err?.error?.message || '견적서 제출에 실패했습니다', variant: 'error' });
          return;
        }

        // 3) UI 업데이트
        setEstimates((prev) =>
          prev.map((e) =>
            e.id === selectedId
              ? { ...e, status: 'in_review' as DocumentStatus, content: data }
              : e,
          ),
        );
        toast({ title: '견적서가 제출되었습니다', message: '프로젝트가 견적 승인 단계로 이동합니다.', variant: 'success' });
      } catch {
        toast({ title: '견적서 제출 중 오류가 발생했습니다', variant: 'error' });
      }
    },
    [selectedId, confirm, toast],
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
            : filtered.map((e) => (
                <div
                  key={e.id}
                  className={`${panel.item} ${isActive(e.id) ? panel.itemActive : ''}`}
                  onClick={() => handleSelect(e)}
                >
                  <span className={panel.itemName}>{e.clientName || e.content?.recipient || '(미지정)'}</span>
                  <span className={panel.itemMeta}>
                    <span>{formatCurrency(e.amount)}</span>
                    <span>·</span>
                    <StatusBadge status={e.status} type="document" />
                  </span>
                </div>
              ))}

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
            initialData={selected.content}
            documentId={selected.id}
            onSave={handleSaveEdit}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        )}
      </div>
    </div>
  );
}