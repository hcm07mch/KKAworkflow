'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { LuFilePen, LuExternalLink } from 'react-icons/lu';
import { StatusBadge, useFeedback } from '@/components/ui';
import { useProjectAssignees } from '@/components/hooks/use-project-assignees';
import type { DocumentStatus, ServiceType, ContractContent } from '@/lib/domain/types';
import { ContractEditor } from './contract-editor';
import panel from '../panel-layout.module.css';

// ── Types ────────────────────────────────────────────────

interface ContractListItem {
  id: string;
  projectId: string;
  projectTitle: string;
  clientId: string;
  clientName: string;
  ownerId: string;
  ownerName: string;
  serviceType: ServiceType;
  status: DocumentStatus;
  monthlyAmount: number;
  contractMonths: number;
  hasFile: boolean;
  createdAt: string;
  content: ContractContent;
}

type RightPanelMode = 'empty' | 'edit';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
}

// ── Page ─────────────────────────────────────────────────

export default function ContractsPage() {
  return (
    <Suspense>
      <ContractsContent />
    </Suspense>
  );
}

function ContractsContent() {
  const searchParams = useSearchParams();
  const { toast, confirm } = useFeedback();
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('contracts_ownerFilter') ?? 'all';
    }
    return 'all';
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<RightPanelMode>('empty');

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((u) => setCurrentUserId(u.id ?? null)).catch(() => {});
  }, []);

  const fetchContracts = useCallback(() => {
    fetch('/api/documents?type=contract')
      .then((r) => r.json())
      .then((docs: any[]) => {
        const items: ContractListItem[] = docs.map((d) => {
          const content: ContractContent = d.content ?? {};
          const monthlyAmount = content.monthly_amount ?? d.project?.total_amount ?? 0;
          const contractMonths = content.contract_months ?? 3;
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
            monthlyAmount,
            contractMonths,
            hasFile: !!content.file_path,
            createdAt: d.created_at,
            content,
          };
        });
        setContracts(items);
        setLoading(false);
        const savedId = searchParams.get('selected') ?? localStorage.getItem('contracts_selectedId');
        if (savedId) {
          const target = items.find((c) => c.id === savedId);
          if (target) { setSelectedId(target.id); setPanelMode('edit'); }
        }
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  // flow_number 기반 넘버링 (동일 프로젝트 여러 건 존재 시만 표시)
  const projectHasSiblings = new Set<string>();
  (() => {
    const cnt: Record<string, number> = {};
    for (const c of contracts) cnt[c.projectId] = (cnt[c.projectId] ?? 0) + 1;
    for (const pid of Object.keys(cnt)) { if (cnt[pid] > 1) projectHasSiblings.add(pid); }
  })();
  const getFlowSuffix = (c: ContractListItem) => {
    if (!projectHasSiblings.has(c.projectId)) return '';
    const fn = (c.content as Record<string, any>)?.flow_number;
    return fn >= 1 ? ` #${fn}` : '';
  };

  const ownerNames = Array.from(new Set(contracts.map((c) => c.ownerName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));

  const filtered = contracts.filter((c) => {
    if (ownerFilter !== 'all' && c.ownerName !== ownerFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return c.projectTitle.toLowerCase().includes(q) || c.clientName.toLowerCase().includes(q);
  });

  const selected = selectedId ? contracts.find((c) => c.id === selectedId) ?? null : null;

  // 선택된 계약 프로젝트의 담당자 권한
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

  const handleSelect = useCallback((item: ContractListItem) => {
    setSelectedId(item.id);
    setPanelMode('edit');
    localStorage.setItem('contracts_selectedId', item.id);
  }, []);

  const handleSaveEdit = useCallback(
    async (data: ContractContent) => {
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

      setContracts((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                monthlyAmount: data.monthly_amount ?? c.monthlyAmount,
                contractMonths: data.contract_months ?? c.contractMonths,
                hasFile: !!data.file_path,
                content: data,
              }
            : c,
        ),
      );
      toast({ title: '계약서 정보가 저장되었습니다', variant: 'success' });
    },
    [selectedId, toast],
  );

  const handleSubmit = useCallback(
    async (data: ContractContent) => {
      if (!selectedId) return;

      const ok = await confirm({
        title: '계약서를 제출하시겠습니까?',
        description: '프로젝트가 계약 승인 단계로 이동합니다.',
        variant: 'info',
        confirmLabel: '제출',
        cancelLabel: '취소',
      });
      if (!ok) return;

      // 먼저 메타 정보 저장
      try {
        await fetch(`/api/documents/${selectedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: data }),
        });
      } catch { /* 제출 자체는 계속 진행 */ }

      // 계약서 제출
      try {
        const res = await fetch(`/api/documents/${selectedId}/contract-submit`, {
          method: 'POST',
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast({ title: err?.error?.message || '계약서 제출에 실패했습니다', variant: 'error' });
          return;
        }

        setContracts((prev) =>
          prev.map((c) =>
            c.id === selectedId
              ? { ...c, status: 'in_review' as DocumentStatus, content: data }
              : c,
          ),
        );
        toast({ title: '계약서가 제출되었습니다', message: '프로젝트가 계약 승인 단계로 이동합니다.', variant: 'success' });
      } catch {
        toast({ title: '계약서 제출 중 오류가 발생했습니다', variant: 'error' });
      }
    },
    [selectedId, confirm, toast],
  );

  const handleRedraft = useCallback(
    async () => {
      if (!selectedId) return;

      const ok = await confirm({
        title: '계약서를 재작성하시겠습니까?',
        description: '계약서가 작성중 상태로 돌아가며 다시 수정할 수 있습니다.',
        variant: 'warning',
        confirmLabel: '재작성',
        cancelLabel: '취소',
      });
      if (!ok) return;

      try {
        const res = await fetch(`/api/documents/${selectedId}/contract-redraft`, {
          method: 'POST',
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast({ title: err?.error?.message || '재작성 전환에 실패했습니다', variant: 'error' });
          return;
        }

        setContracts((prev) =>
          prev.map((c) =>
            c.id === selectedId
              ? { ...c, status: 'draft' as DocumentStatus }
              : c,
          ),
        );
        toast({ title: '계약서가 재작성 상태로 전환되었습니다', variant: 'success' });
      } catch {
        toast({ title: '재작성 전환 중 오류가 발생했습니다', variant: 'error' });
      }
    },
    [selectedId, confirm, toast],
  );

  const handleStatusChange = useCallback(
    (newStatus: string) => {
      if (!selectedId) return;
      setContracts((prev) =>
        prev.map((c) =>
          c.id === selectedId ? { ...c, status: newStatus as DocumentStatus } : c,
        ),
      );
    },
    [selectedId],
  );

  const handleFileUploaded = useCallback(() => {
    fetchContracts();
  }, [fetchContracts]);

  function isActive(id: string) {
    return panelMode === 'edit' && selectedId === id;
  }

  return (
    <div className={panel.wrapper}>
      {/* ══════════ Left Panel ══════════ */}
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <div className={panel.leftTitleRow}>
            <span className={panel.leftTitle}>계약서</span>
            <select
              className={panel.sortSelect}
              value={ownerFilter}
              onChange={(e) => {
                const v = e.target.value;
                setOwnerFilter(v);
                localStorage.setItem('contracts_ownerFilter', v);
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
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={panel.skeletonItem}>
                  <div className={panel.skeletonBar} style={{ width: '55%' }} />
                  <div className={panel.skeletonBar} style={{ width: '35%', height: 8 }} />
                </div>
              ))
            : filtered.map((c) => {
                const suffix = getFlowSuffix(c);
                return (
                <div
                  key={c.id}
                  className={`${panel.item} ${isActive(c.id) ? panel.itemActive : ''}`}
                  onClick={() => handleSelect(c)}
                >
                  <span className={panel.itemNameRow}>
                    <span className={panel.itemName}>{c.projectTitle || '(미지정)'}{suffix}</span>
                    {c.projectId && (
                      <a
                        href={`/projects?selected=${c.projectId}`}
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
                    <span>{c.ownerName}</span>
                    <span>·</span>
                    <span>{formatCurrency(c.monthlyAmount)}/월</span>
                    <span>·</span>
                    <StatusBadge status={c.status} type="document" />
                  </span>
                </div>
              ); })}

          {!loading && filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              계약서가 없습니다.
            </div>
          )}
        </div>
        <div className={panel.leftFooter}>{loading ? '-' : `${filtered.length}건`}</div>
      </div>

      {/* ══════════ Right Panel ══════════ */}
      <div className={panel.rightPanel} style={{ padding: panelMode !== 'empty' ? 0 : undefined }}>
        {panelMode === 'empty' && (
          <div className={panel.emptyState}>
            <span className={panel.emptyIcon}><LuFilePen size={32} /></span>
            <span>계약서를 선택하세요</span>
          </div>
        )}

        {panelMode === 'edit' && selected && (
          <ContractEditor
            key={selected.id}
            mode="upload"
            initialData={selected.content}
            documentId={selected.id}
            clientName={selected.clientName}
            readOnly={selected.status !== 'draft'}
            documentStatus={selected.status}
            onSave={(data) => { if (ensureAssignee()) handleSaveEdit(data); }}
            onSubmit={(data) => { if (ensureAssignee()) handleSubmit(data); }}
            onRedraft={() => { if (ensureAssignee()) handleRedraft(); }}
            onStatusChange={handleStatusChange}
            onFileUploaded={handleFileUploaded}
          />
        )}
      </div>
    </div>
  );
}