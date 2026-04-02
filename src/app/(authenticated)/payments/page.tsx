'use client';

import { useEffect, useState } from 'react';
import { LuCreditCard, LuLoader } from 'react-icons/lu';
import { ActionButton } from '@/components/ui';
import { SERVICE_TYPE_META } from '@/lib/domain/types';
import type { ServiceType } from '@/lib/domain/types';
import panel from '../panel-layout.module.css';

// ── Types ────────────────────────────────────────────────

type PaymentStatus = 'pending' | 'confirmed';
const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; badge: string }> = {
  pending:   { label: '입금 대기', badge: 'badge-yellow' },
  confirmed: { label: '입금 완료', badge: 'badge-green' },
};

interface PaymentItem {
  id: string;
  projectTitle: string;
  clientName: string;
  serviceType: ServiceType;
  status: PaymentStatus;
  amount: number;
  startDate: string | null;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
}
function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Page ─────────────────────────────────────────────────

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PaymentStatus | 'all'>('all');
  const [selected, setSelected] = useState<PaymentItem | null>(null);

  useEffect(() => {
    fetch('/api/projects?status=D1_payment_pending,D2_payment_confirmed&limit=200')
      .then((r) => r.json())
      .then((res) => {
        const items: PaymentItem[] = (res.data ?? []).map((p: any) => ({
          id: p.id,
          projectTitle: p.title,
          clientName: p.client?.name ?? '',
          serviceType: p.service_type,
          status: p.status === 'D2_payment_confirmed' ? 'confirmed' : 'pending',
          amount: p.total_amount ?? 0,
          startDate: p.start_date,
        }));
        setPayments(items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = payments.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.projectTitle.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q);
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
          <div className={panel.leftActions}>
            <span className={panel.leftTitle}>입금 확인</span>
          </div>
          <input className={panel.searchInput} placeholder="프로젝트, 고객사 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className={panel.filterTabs}>
            <button type="button" className={`${panel.filterTab} ${filter === 'all' ? panel.filterTabActive : ''}`} onClick={() => setFilter('all')}>전체</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'pending' ? panel.filterTabActive : ''}`} onClick={() => setFilter('pending')}>대기</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'confirmed' ? panel.filterTabActive : ''}`} onClick={() => setFilter('confirmed')}>완료</button>
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
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>입금 건이 없습니다.</div>
          )}
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
                <div className={panel.detailField}><span className={panel.fieldLabel}>서비스 유형</span><span className={panel.fieldValue}>{SERVICE_TYPE_META[selected.serviceType]?.label ?? '-'}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>금액</span><span className={panel.fieldValue}>{formatCurrency(selected.amount)}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>시작일</span><span className={panel.fieldValue}>{formatDate(selected.startDate)}</span></div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}