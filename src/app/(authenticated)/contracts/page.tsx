'use client';

import { useEffect, useState, useCallback } from 'react';
import { LuFilePen, LuLoader, LuPlus } from 'react-icons/lu';
import { StatusBadge, ActionButton } from '@/components/ui';
import type { DocumentStatus, ServiceType } from '@/lib/domain/types';
import { SERVICE_TYPE_META } from '@/lib/domain/types';
import panel from '../panel-layout.module.css';

// ── Types ────────────────────────────────────────────────

interface ContractItem {
  id: string;
  projectTitle: string;
  clientName: string;
  serviceType: ServiceType;
  status: DocumentStatus;
  monthlyAmount: number;
  contractMonths: number;
  startDate: string | null;
  createdAt: string;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
}
function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Page ─────────────────────────────────────────────────

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ContractItem | null>(null);

  const selectContract = useCallback((c: ContractItem) => {
    setSelected(c);
    localStorage.setItem('contracts_selectedId', c.id);
  }, []);

  useEffect(() => {
    fetch('/api/documents?type=contract')
      .then((r) => r.json())
      .then((docs: any[]) => {
        const items: ContractItem[] = docs.map((d) => {
          const content = d.content ?? {};
          const monthlyAmount = content.monthly_amount ?? content.monthlyAmount ?? d.project?.total_amount ?? 0;
          const contractMonths = 3; // default
          return {
            id: d.id,
            projectTitle: d.project?.title ?? '',
            clientName: d.project?.client?.name ?? '',
            serviceType: d.project?.service_type ?? 'viral',
            status: d.status,
            monthlyAmount,
            contractMonths,
            startDate: content.effective_date ?? d.project?.start_date ?? null,
            createdAt: d.created_at,
          };
        });
        setContracts(items);
        setLoading(false);
        const savedId = localStorage.getItem('contracts_selectedId');
        if (savedId) {
          const target = items.find((c) => c.id === savedId);
          if (target) setSelected(target);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = contracts.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      return c.projectTitle.toLowerCase().includes(q) || c.clientName.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className={panel.wrapper}>
        <div className={panel.leftPanel}>
          <div className={panel.leftHeader}>
            <span className={panel.leftTitle}>계약서</span>
            <div className={panel.searchInput} style={{ opacity: 0.5 }} />
          </div>
          <div className={panel.itemList}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={panel.skeletonItem}>
                <div className={panel.skeletonBar} style={{ width: '55%' }} />
                <div className={panel.skeletonBar} style={{ width: '35%', height: 8 }} />
              </div>
            ))}
          </div>
        </div>
        <div className={panel.rightPanel}>
          <div className={panel.emptyState}>
            <span className={panel.emptyIcon}><LuFilePen size={32} /></span>
            <span>계약서를 선택하세요</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={panel.wrapper}>
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <span className={panel.leftTitle}>계약서</span>
          <input className={panel.searchInput} placeholder="프로젝트, 고객사 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className={panel.itemList}>
          <div className={panel.addItem} onClick={() => alert('계약서 작성 (TODO)')}>
            <LuPlus size={14} /> 새 계약서
          </div>
          {filtered.map((c) => (
            <div key={c.id} className={`${panel.item} ${selected?.id === c.id ? panel.itemActive : ''}`} onClick={() => selectContract(c)}>
              <span className={panel.itemName}>{c.clientName}</span>
              <span className={panel.itemMeta}>
                <span>{formatCurrency(c.monthlyAmount)}/월</span>
                <span>·</span>
                <StatusBadge status={c.status} type="document" />
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>계약서가 없습니다.</div>
          )}
        </div>
        <div className={panel.leftFooter}>{filtered.length}건</div>
      </div>

      <div className={panel.rightPanel}>
        {!selected ? (
          <div className={panel.emptyState}><span className={panel.emptyIcon}><LuFilePen size={32} /></span><span>계약서를 선택하세요</span></div>
        ) : (
          <>
            <div className={panel.detailHeader}>
              <div>
                <div className={panel.detailTitle}>{selected.clientName}</div>
                <div className={panel.detailSubtitle}>{selected.projectTitle}</div>
              </div>
              <div className={panel.detailActions}>
                <ActionButton label="발송" variant="primary" size="sm" onClick={() => alert('발송 (TODO)')} />
                <ActionButton label="수정" variant="secondary" size="sm" onClick={() => alert('수정 (TODO)')} />
              </div>
            </div>
            <div className="card">
              <div className={panel.detailGrid}>
                <div className={panel.detailField}><span className={panel.fieldLabel}>고객사</span><span className={panel.fieldValue}>{selected.clientName}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>상태</span><span className={panel.fieldValue}><StatusBadge status={selected.status} type="document" /></span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>서비스 유형</span><span className={panel.fieldValue}>{SERVICE_TYPE_META[selected.serviceType]?.label ?? '-'}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>월 금액</span><span className={panel.fieldValue}>{formatCurrency(selected.monthlyAmount)}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>계약 기간</span><span className={panel.fieldValue}>{selected.contractMonths}개월</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>총 금액</span><span className={panel.fieldValue}>{formatCurrency(selected.monthlyAmount * selected.contractMonths)}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>시작일</span><span className={panel.fieldValue}>{formatDate(selected.startDate)}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>작성일</span><span className={panel.fieldValue}>{formatDate(selected.createdAt)}</span></div>
              </div>
            </div>
            <div className={panel.detailSection}>
              <div className={panel.detailSectionTitle}>승인 이력</div>
              <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>승인/반려 이력이 여기에 표시됩니다.</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}