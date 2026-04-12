'use client';

import { useEffect, useState, useCallback } from 'react';
import { LuCreditCard, LuExternalLink, LuCheck } from 'react-icons/lu';
import { StatusBadge, useFeedback } from '@/components/ui';
import { SERVICE_TYPE_META, PAYMENT_TYPE_META } from '@/lib/domain/types';
import type { ServiceType, ProjectStatus } from '@/lib/domain/types';
import panel from '../panel-layout.module.css';

// ── Types ────────────────────────────────────────────────

type PaymentStatus = 'pending' | 'confirmed';
const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; badge: string }> = {
  pending:   { label: '입금 대기', badge: 'badge-yellow' },
  confirmed: { label: '입금 완료', badge: 'badge-green' },
};

interface PaymentItem {
  id: string;           // document ID
  projectId: string;
  projectTitle: string;
  clientName: string;
  ownerName: string;
  serviceType: ServiceType;
  projectStatus: ProjectStatus;
  status: PaymentStatus;
  paymentType: string;
  amount: number;
  months: number | null;
  confirmedAt: string | null;
  createdAt: string;
  title: string;        // document title
  flowNumber: number | null;
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
  const { toast, confirm } = useFeedback();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PaymentStatus | 'all'>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('payments_ownerFilter') ?? 'all';
    }
    return 'all';
  });
  const [selected, setSelected] = useState<PaymentItem | null>(null);

  const selectPayment = useCallback((p: PaymentItem) => {
    setSelected(p);
    localStorage.setItem('payments_selectedId', p.id);
  }, []);

  useEffect(() => {
    fetch('/api/documents?type=payment')
      .then((r) => r.json())
      .then((docs: any[]) => {
        const items: PaymentItem[] = docs.map((d) => {
          const content = d.content ?? {};
          return {
            id: d.id,
            projectId: d.project?.id ?? '',
            projectTitle: d.project?.title ?? '',
            clientName: d.project?.client?.name ?? '',
            ownerName: d.project?.owner?.name ?? '-',
            serviceType: d.project?.service_type ?? 'viral',
            projectStatus: d.project?.status,
            status: content.confirmed_at ? 'confirmed' as PaymentStatus : 'pending' as PaymentStatus,
            paymentType: content.payment_type ?? 'per_invoice',
            amount: content.amount ?? 0,
            months: content.months ?? null,
            confirmedAt: content.confirmed_at ?? null,
            createdAt: d.created_at,
            title: d.title ?? '',
            flowNumber: content.flow_number ?? null,
          };
        });
        setPayments(items);
        setLoading(false);
        const savedId = localStorage.getItem('payments_selectedId');
        if (savedId) {
          const target = items.find((p) => p.id === savedId);
          if (target) selectPayment(target);
        }
      })
      .catch(() => setLoading(false));
  }, [selectPayment]);

  // 동일 프로젝트 여러 건 존재 시 flow_number 표시
  const projectHasSiblings = new Set<string>();
  (() => {
    const cnt: Record<string, number> = {};
    for (const p of payments) cnt[p.projectId] = (cnt[p.projectId] ?? 0) + 1;
    for (const pid of Object.keys(cnt)) { if (cnt[pid] > 1) projectHasSiblings.add(pid); }
  })();

  const ownerNames = Array.from(new Set(payments.map((p) => p.ownerName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));

  async function handleConfirmPayment() {
    if (!selected || selected.status !== 'pending') return;
    const ok = await confirm({ title: `"${selected.title || selected.clientName}" 입금을 확인 처리하시겠습니까?` });
    if (!ok) return;
    setConfirming(true);
    try {
      // 문서 content에 confirmed_at 기록
      const docRes = await fetch(`/api/documents/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { ...({ payment_type: selected.paymentType, amount: selected.amount, months: selected.months, flow_number: selected.flowNumber } as Record<string, unknown>), confirmed_at: new Date().toISOString() } }),
      });
      if (!docRes.ok) throw new Error();
      // 프로젝트 상태를 D2_payment_confirmed로 변경
      await fetch(`/api/projects/${selected.projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'D2_payment_confirmed' }),
      });
      // 로컬 상태 업데이트
      const now = new Date().toISOString();
      setPayments((prev) => prev.map((p) => p.id === selected.id ? { ...p, status: 'confirmed' as PaymentStatus, confirmedAt: now } : p));
      setSelected((prev) => prev ? { ...prev, status: 'confirmed' as PaymentStatus, confirmedAt: now } : prev);
      toast({ title: '입금이 확인되었습니다', variant: 'success' });
    } catch {
      toast({ title: '입금 확인에 실패했습니다', variant: 'error' });
    } finally {
      setConfirming(false);
    }
  }

  const filtered = payments.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (ownerFilter !== 'all' && p.ownerName !== ownerFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.projectTitle.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className={panel.wrapper}>
        <div className={panel.leftPanel}>
          <div className={panel.leftHeader}>
            <span className={panel.leftTitle}>입금 확인</span>
            <div className={panel.searchInput} style={{ opacity: 0.5 }} />
          </div>
          <div className={panel.itemList}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={panel.skeletonItem}>
                <div className={panel.skeletonBar} style={{ width: '60%' }} />
                <div className={panel.skeletonBar} style={{ width: '40%', height: 8 }} />
              </div>
            ))}
          </div>
        </div>
        <div className={panel.rightPanel}>
          <div className={panel.emptyState}>
            <span className={panel.emptyIcon}><LuCreditCard size={32} /></span>
            <span>건을 선택하세요</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={panel.wrapper}>
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <div className={panel.leftTitleRow}>
            <span className={panel.leftTitle}>입금 확인</span>
            <select
              className={panel.sortSelect}
              value={ownerFilter}
              onChange={(e) => {
                const v = e.target.value;
                setOwnerFilter(v);
                localStorage.setItem('payments_ownerFilter', v);
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
            <button type="button" className={`${panel.filterTab} ${filter === 'pending' ? panel.filterTabActive : ''}`} onClick={() => setFilter('pending')}>대기</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'confirmed' ? panel.filterTabActive : ''}`} onClick={() => setFilter('confirmed')}>완료</button>
          </div>
        </div>
        <div className={panel.itemList}>
          {filtered.map((p) => (
            <div key={p.id} className={`${panel.item} ${selected?.id === p.id ? panel.itemActive : ''}`} onClick={() => selectPayment(p)}>
              <span className={panel.itemNameRow}>
                <span className={panel.itemName}>{p.clientName}{projectHasSiblings.has(p.projectId) && p.flowNumber ? ` #${p.flowNumber}` : ''}</span>
                <a
                  href={`/projects?selected=${p.projectId}`}
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
                <span>{p.ownerName}</span>
                <span>·</span>
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
                <div className={panel.detailTitle}>{selected.title || selected.clientName}</div>
                <div className={panel.detailSubtitle}>{selected.projectTitle}</div>
              </div>
            </div>

            {/* 입금 정보 */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className={panel.formTable}>
                <tbody>
                  <tr>
                    <th>입금 상태</th>
                    <td><span className={`badge badge-sm ${PAYMENT_STATUS_META[selected.status].badge}`}>{PAYMENT_STATUS_META[selected.status].label}</span></td>
                  </tr>
                  <tr>
                    <th>프로젝트</th>
                    <td>
                      <a href={`/projects?selected=${selected.projectId}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
                        {selected.projectTitle}
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <th>고객사</th>
                    <td><span className={panel.fieldValue}>{selected.clientName}</span></td>
                  </tr>
                  <tr>
                    <th>담당자</th>
                    <td><span className={panel.fieldValue}>{selected.ownerName}</span></td>
                  </tr>
                  <tr>
                    <th>서비스 유형</th>
                    <td><span className={panel.fieldValue}>{SERVICE_TYPE_META[selected.serviceType]?.label ?? '-'}</span></td>
                  </tr>
                  <tr>
                    <th>결제 방식</th>
                    <td><span className={panel.fieldValue}>{PAYMENT_TYPE_META[selected.paymentType as keyof typeof PAYMENT_TYPE_META]?.label ?? selected.paymentType}</span></td>
                  </tr>
                  <tr>
                    <th>입금 금액</th>
                    <td><span className={panel.fieldValue} style={{ fontWeight: 600 }}>{formatCurrency(selected.amount)}</span></td>
                  </tr>
                  {selected.months != null && selected.months > 0 && (
                    <tr>
                      <th>개월 수</th>
                      <td><span className={panel.fieldValue}>{selected.months}개월</span></td>
                    </tr>
                  )}
                  {selected.confirmedAt && (
                    <tr>
                      <th>입금 확인일</th>
                      <td><span className={panel.fieldValue}>{formatDate(selected.confirmedAt)}</span></td>
                    </tr>
                  )}
                  <tr>
                    <th>등록일</th>
                    <td><span className={panel.fieldValue}>{formatDate(selected.createdAt)}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 입금 확인 버튼 */}
            {selected.status === 'pending' && (
              <div style={{ padding: '16px 0' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', fontWeight: 600 }}
                  onClick={handleConfirmPayment}
                  disabled={confirming}
                >
                  <LuCheck size={16} />
                  {confirming ? '처리 중...' : '입금 확인'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}