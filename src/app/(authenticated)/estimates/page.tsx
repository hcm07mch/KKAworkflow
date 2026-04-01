'use client';

import { useState } from 'react';
import { LuFileText } from 'react-icons/lu';
import { StatusBadge, ActionButton } from '@/components/ui';
import type { DocumentStatus, ServiceType } from '@/lib/domain/types';
import { DOCUMENT_STATUS_META, SERVICE_TYPE_META } from '@/lib/domain/types';
import panel from '../panel-layout.module.css';

// ── Mock Data ────────────────────────────────────────────

interface EstimateItem {
  id: string;
  code: string;
  projectTitle: string;
  clientName: string;
  serviceType: ServiceType;
  status: DocumentStatus;
  amount: number;
  isMonthly: boolean;
  createdAt: string;
  sentAt: string | null;
}

const MOCK_ESTIMATES: EstimateItem[] = [
  { id: 'e1', code: 'EST-2026-001', projectTitle: '블루오션 3월 마케팅 대행', clientName: '(주)블루오션 마케팅', serviceType: 'viral_performance', status: 'sent', amount: 3960000, isMonthly: true, createdAt: '2026-03-10', sentAt: '2026-03-11' },
  { id: 'e2', code: 'EST-2026-002', projectTitle: '그린텍 브랜드 프로젝트', clientName: '그린텍', serviceType: 'performance', status: 'approved', amount: 5500000, isMonthly: true, createdAt: '2026-03-15', sentAt: '2026-03-16' },
  { id: 'e3', code: 'EST-2026-003', projectTitle: '스카이미디어 SNS 대행', clientName: '스카이미디어', serviceType: 'viral', status: 'sent', amount: 2200000, isMonthly: false, createdAt: '2026-03-20', sentAt: '2026-03-21' },
  { id: 'e4', code: 'EST-2026-004', projectTitle: '하이브랜드 캠페인', clientName: '하이브랜드', serviceType: 'viral_performance', status: 'draft', amount: 4800000, isMonthly: true, createdAt: '2026-03-25', sentAt: null },
  { id: 'e5', code: 'EST-2026-005', projectTitle: '오렌지원 봄시즌 바이럴', clientName: '오렌지원', serviceType: 'viral', status: 'approved', amount: 1800000, isMonthly: false, createdAt: '2026-01-25', sentAt: '2026-01-26' },
  { id: 'e6', code: 'EST-2026-006', projectTitle: '레드스타 인플루언서 마케팅', clientName: '레드스타', serviceType: 'viral', status: 'rejected', amount: 8000000, isMonthly: false, createdAt: '2026-03-15', sentAt: '2026-03-16' },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
}
function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Page ─────────────────────────────────────────────────

export default function EstimatesPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'monthly' | 'single'>('all');
  const [selected, setSelected] = useState<EstimateItem | null>(null);

  const filtered = MOCK_ESTIMATES.filter((e) => {
    if (filter === 'monthly' && !e.isMonthly) return false;
    if (filter === 'single' && e.isMonthly) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.projectTitle.toLowerCase().includes(q) || e.clientName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className={panel.wrapper}>
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <div className={panel.leftActions}>
            <span className={panel.leftTitle}>견적서</span>
            <ActionButton label="+ 작성" variant="primary" size="sm" onClick={() => alert('견적서 작성 (TODO)')} />
          </div>
          <input className={panel.searchInput} placeholder="프로젝트, 고객사 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className={panel.filterTabs}>
            <button type="button" className={`${panel.filterTab} ${filter === 'all' ? panel.filterTabActive : ''}`} onClick={() => setFilter('all')}>전체</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'single' ? panel.filterTabActive : ''}`} onClick={() => setFilter('single')}>단일 결제</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'monthly' ? panel.filterTabActive : ''}`} onClick={() => setFilter('monthly')}>월 계약</button>
          </div>
        </div>
        <div className={panel.itemList}>
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
                <div className={panel.detailTitle}>{selected.code}</div>
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
                <div className={panel.detailField}><span className={panel.fieldLabel}>서비스 유형</span><span className={panel.fieldValue}>{SERVICE_TYPE_META[selected.serviceType].label}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>결제 유형</span><span className={panel.fieldValue}>{selected.isMonthly ? '월 계약' : '단일 결제'}</span></div>
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
