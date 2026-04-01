'use client';

import { useState } from 'react';
import { LuCreditCard } from 'react-icons/lu';
import { ActionButton } from '@/components/ui';
import { SERVICE_TYPE_META } from '@/lib/domain/types';
import type { ServiceType } from '@/lib/domain/types';
import panel from '../panel-layout.module.css';

// ── Mock Data ────────────────────────────────────────────

type PaymentStatus = 'pending' | 'confirmed' | 'overdue';
const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; badge: string }> = {
  pending:   { label: '입금 대기', badge: 'badge-yellow' },
  confirmed: { label: '입금 완료', badge: 'badge-green' },
  overdue:   { label: '연체',     badge: 'badge-red' },
};

interface PaymentItem {
  id: string;
  projectTitle: string;
  clientName: string;
  serviceType: ServiceType;
  status: PaymentStatus;
  amount: number;
  dueDate: string;
  paidAt: string | null;
}

const MOCK_PAYMENTS: PaymentItem[] = [
  { id: 'pm1', projectTitle: '블루오션 3월 마케팅 대행', clientName: '(주)블루오션 마케팅', serviceType: 'viral_performance', status: 'confirmed', amount: 3960000, dueDate: '2026-03-14', paidAt: '2026-03-13' },
  { id: 'pm2', projectTitle: '그린텍 브랜드 프로젝트', clientName: '그린텍', serviceType: 'performance', status: 'pending', amount: 5500000, dueDate: '2026-04-05', paidAt: null },
  { id: 'pm3', projectTitle: '스카이미디어 SNS 대행', clientName: '스카이미디어', serviceType: 'viral', status: 'pending', amount: 2200000, dueDate: '2026-04-10', paidAt: null },
  { id: 'pm4', projectTitle: '오렌지원 봄시즌 바이럴', clientName: '오렌지원', serviceType: 'viral', status: 'confirmed', amount: 1800000, dueDate: '2026-02-05', paidAt: '2026-02-03' },
  { id: 'pm5', projectTitle: '모어마케팅 블로그 대행', clientName: '모어마케팅', serviceType: 'performance', status: 'confirmed', amount: 3000000, dueDate: '2026-03-30', paidAt: '2026-03-28' },
  { id: 'pm6', projectTitle: '하이브랜드 캠페인', clientName: '하이브랜드', serviceType: 'viral_performance', status: 'overdue', amount: 4800000, dueDate: '2026-03-20', paidAt: null },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
}
function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Page ─────────────────────────────────────────────────

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PaymentStatus | 'all'>('all');
  const [selected, setSelected] = useState<PaymentItem | null>(null);

  const filtered = MOCK_PAYMENTS.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.projectTitle.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className={panel.wrapper}>
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <div className={panel.leftActions}>
            <span className={panel.leftTitle}>입금 확인</span>
          </div>
          <input className={panel.searchInput} placeholder="프로젝트, 고객사 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className={panel.filterTabs}>
            <button type="button" className={`${panel.filterTab} ${filter === 'all' ? panel.filterTabActive : ''}`} onClick={() => setFilter('all')}>전체</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'pending' ? panel.filterTabActive : ''}`} onClick={() => setFilter('pending')}>대기</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'confirmed' ? panel.filterTabActive : ''}`} onClick={() => setFilter('confirmed')}>완료</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'overdue' ? panel.filterTabActive : ''}`} onClick={() => setFilter('overdue')}>연체</button>
          </div>
        </div>
        <div className={panel.itemList}>
          {filtered.map((p) => (
            <div key={p.id} className={`${panel.item} ${selected?.id === p.id ? panel.itemActive : ''}`} onClick={() => setSelected(p)}>
              <span className={panel.itemName}>{p.clientName}</span>
              <span className={panel.itemMeta}>
                <span>{formatCurrency(p.amount)}</span>
                <span>·</span>
                <span className={`badge badge-sm ${PAYMENT_STATUS_META[p.status].badge}`}>{PAYMENT_STATUS_META[p.status].label}</span>
              </span>
            </div>
          ))}
        </div>
        <div className={panel.leftFooter}>{filtered.length}건</div>
      </div>

      <div className={panel.rightPanel}>
        {!selected ? (
          <div className={panel.emptyState}><span className={panel.emptyIcon}><LuCreditCard size={32} /></span><span>입금 건을 선택하세요</span></div>
        ) : (
          <>
            <div className={panel.detailHeader}>
              <div>
                <div className={panel.detailTitle}>{selected.clientName}</div>
                <div className={panel.detailSubtitle}>{selected.projectTitle}</div>
              </div>
              <div className={panel.detailActions}>
                {selected.status === 'pending' && (
                  <ActionButton label="입금 확인" variant="primary" size="sm" onClick={() => alert('입금 확인 (TODO)')} />
                )}
              </div>
            </div>
            <div className="card">
              <div className={panel.detailGrid}>
                <div className={panel.detailField}><span className={panel.fieldLabel}>상태</span><span className={panel.fieldValue}><span className={`badge badge-sm ${PAYMENT_STATUS_META[selected.status].badge}`}>{PAYMENT_STATUS_META[selected.status].label}</span></span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>서비스 유형</span><span className={panel.fieldValue}>{SERVICE_TYPE_META[selected.serviceType].label}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>금액</span><span className={panel.fieldValue}>{formatCurrency(selected.amount)}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>입금 기한</span><span className={panel.fieldValue}>{formatDate(selected.dueDate)}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>입금일</span><span className={panel.fieldValue}>{formatDate(selected.paidAt)}</span></div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
