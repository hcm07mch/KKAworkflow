'use client';

import { useEffect, useState } from 'react';
import { LuFileText, LuLoader, LuPlus } from 'react-icons/lu';
import { StatusBadge, ActionButton } from '@/components/ui';
import type { DocumentStatus, ServiceType } from '@/lib/domain/types';
import { DOCUMENT_STATUS_META, SERVICE_TYPE_META } from '@/lib/domain/types';
import panel from '../panel-layout.module.css';

// ── Types ────────────────────────────────────────────────

interface EstimateItem {
  id: string;
  projectTitle: string;
  clientName: string;
  serviceType: ServiceType;
  status: DocumentStatus;
  amount: number;
  createdAt: string;
  sentAt: string | null;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
}
function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Page ─────────────────────────────────────────────────

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState<EstimateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<EstimateItem | null>(null);

  useEffect(() => {
    fetch('/api/documents?type=estimate')
      .then((r) => r.json())
      .then((docs: any[]) => {
        const items: EstimateItem[] = docs.map((d) => {
          const content = d.content ?? {};
          const amount = content.total ?? content.subtotal ?? d.project?.total_amount ?? 0;
          return {
            id: d.id,
            projectTitle: d.project?.title ?? '',
            clientName: d.project?.client?.name ?? '',
            serviceType: d.project?.service_type ?? 'viral',
            status: d.status,
            amount,
            createdAt: d.created_at,
            sentAt: d.sent_at,
          };
        });
        setEstimates(items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = estimates.filter((e) => {
    if (search) {
      const q = search.toLowerCase();
      return e.projectTitle.toLowerCase().includes(q) || e.clientName.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className={panel.wrapper} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <LuLoader size={24} className="spin" />
      </div>
    );
  }

  return (
    <div className={panel.wrapper}>
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <span className={panel.leftTitle}>견적서</span>
          <input className={panel.searchInput} placeholder="프로젝트, 고객사 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className={panel.itemList}>
          <div className={panel.addItem} onClick={() => alert('견적서 작성 (TODO)')}>
            <LuPlus size={14} /> 새 견적서
          </div>
          {filtered.map((e) => (
            <div key={e.id} className={`${panel.item} ${selected?.id === e.id ? panel.itemActive : ''}`} onClick={() => setSelected(e)}>
              <span className={panel.itemName}>{e.clientName}</span>
              <span className={panel.itemMeta}>
                <span>{formatCurrency(e.amount)}</span>
                <span>·</span>
                <StatusBadge status={e.status} type="document" />
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>견적서가 없습니다.</div>
          )}
        </div>
        <div className={panel.leftFooter}>{filtered.length}건</div>
      </div>

      <div className={panel.rightPanel}>
        {!selected ? (
          <div className={panel.emptyState}><span className={panel.emptyIcon}><LuFileText size={32} /></span><span>견적서를 선택하세요</span></div>
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
                <div className={panel.detailField}><span className={panel.fieldLabel}>금액</span><span className={panel.fieldValue}>{formatCurrency(selected.amount)}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>작성일</span><span className={panel.fieldValue}>{formatDate(selected.createdAt)}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>발송일</span><span className={panel.fieldValue}>{formatDate(selected.sentAt)}</span></div>
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