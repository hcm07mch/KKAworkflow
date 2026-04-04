'use client';

import { useEffect, useState, useCallback } from 'react';
import { LuCreditCard, LuLoader } from 'react-icons/lu';
import { ActionButton, StatusBadge } from '@/components/ui';
import { SERVICE_TYPE_META, PROJECT_STATUS_META, DOCUMENT_TYPE_META } from '@/lib/domain/types';
import type { ServiceType, ProjectStatus, DocumentStatus, DocumentType } from '@/lib/domain/types';
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
  projectCode: string;
  clientName: string;
  ownerName: string;
  serviceType: ServiceType;
  projectStatus: ProjectStatus;
  status: PaymentStatus;
  amount: number;
  startDate: string | null;
  endDate: string | null;
  paymentConfirmedAt: string | null;
}

interface PaymentDetail {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  status: ProjectStatus;
  service_type: ServiceType;
  total_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
  client: { id: string; name: string; contact_name: string | null };
  owner: { id: string; name: string } | null;
  documents: {
    id: string;
    type: DocumentType;
    status: DocumentStatus;
    version: number;
    title: string;
    updated_at: string;
  }[];
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
  const [ownerFilter, setOwnerFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('payments_ownerFilter') ?? 'all';
    }
    return 'all';
  });
  const [selected, setSelected] = useState<PaymentItem | null>(null);
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const selectPayment = useCallback((p: PaymentItem) => {
    setSelected(p);
    localStorage.setItem('payments_selectedId', p.id);
    setDetail(null);
    setDetailLoading(true);
    fetch(`/api/projects/${p.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error();
        setDetail(data);
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/projects?status=D1_payment_pending,D2_payment_confirmed&limit=200')
      .then((r) => r.json())
      .then((res) => {
        const items: PaymentItem[] = (res.data ?? []).map((p: any) => ({
          id: p.id,
          projectTitle: p.title,
          projectCode: p.code ?? '',
          clientName: p.client?.name ?? '',
          ownerName: p.owner?.name ?? '-',
          serviceType: p.service_type,
          projectStatus: p.status,
          status: p.metadata?.payment_confirmed_at ? 'confirmed' as PaymentStatus : 'pending' as PaymentStatus,
          amount: p.total_amount ?? 0,
          startDate: p.start_date,
          endDate: p.end_date,
          paymentConfirmedAt: p.metadata?.payment_confirmed_at ?? null,
        }));
        setPayments(items);
        setLoading(false);
        const savedId = localStorage.getItem('payments_selectedId');
        if (savedId) {
          const target = items.find((p) => p.id === savedId);
          if (target) setSelected(target);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const ownerNames = Array.from(new Set(payments.map((p) => p.ownerName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));

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
                <div className={panel.detailSubtitle}>{selected.projectCode} · {selected.projectTitle}</div>
              </div>
              <div className={panel.detailActions}>
                {selected.status === 'pending' && (
                  <ActionButton label="입금 확인" variant="primary" size="sm" onClick={() => {
                    if (!confirm('입금을 확인하시겠습니까?')) return;
                    const now = new Date().toISOString();
                    const prevStatus = selected.status;
                    // 낙관적 업데이트
                    setSelected((prev) => prev ? { ...prev, status: 'confirmed', paymentConfirmedAt: now } : prev);
                    setPayments((prev) => prev.map((p) => p.id === selected.id ? { ...p, status: 'confirmed' as PaymentStatus, paymentConfirmedAt: now } : p));
                    fetch(`/api/projects/${selected.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ metadata: { ...(detail?.metadata ?? {}), payment_confirmed_at: now } }),
                    }).catch(() => {
                      setSelected((prev) => prev ? { ...prev, status: prevStatus, paymentConfirmedAt: null } : prev);
                      setPayments((prev) => prev.map((p) => p.id === selected.id ? { ...p, status: prevStatus, paymentConfirmedAt: null } : p));
                      alert('입금 확인에 실패했습니다.');
                    });
                  }} />
                )}
              </div>
            </div>

            {/* 프로젝트 기본 정보 */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className={panel.formTable}>
                <tbody>
                  <tr>
                    <th>입금 상태</th>
                    <td><span className={`badge badge-sm ${PAYMENT_STATUS_META[selected.status].badge}`}>{PAYMENT_STATUS_META[selected.status].label}</span></td>
                  </tr>
                  <tr>
                    <th>프로젝트</th>
                    <td><span className={panel.fieldValue}>{selected.projectTitle}</span></td>
                  </tr>
                  <tr>
                    <th>고객사</th>
                    <td><span className={panel.fieldValue}>{detail?.client?.name ?? selected.clientName}</span></td>
                  </tr>
                  <tr>
                    <th>담당자</th>
                    <td><span className={panel.fieldValue}>{detail?.owner?.name ?? selected.ownerName}</span></td>
                  </tr>
                  <tr>
                    <th>서비스 유형</th>
                    <td><span className={panel.fieldValue}>{SERVICE_TYPE_META[selected.serviceType]?.label ?? '-'}</span></td>
                  </tr>
                  <tr>
                    <th>프로젝트 상태</th>
                    <td><StatusBadge status={selected.projectStatus} type="project" /></td>
                  </tr>
                  <tr>
                    <th>입금 금액</th>
                    <td><span className={panel.fieldValue} style={{ fontWeight: 600 }}>{formatCurrency(selected.amount)}</span></td>
                  </tr>
                  <tr>
                    <th>시작일</th>
                    <td><span className={panel.fieldValue}>{formatDate(selected.startDate)}</span></td>
                  </tr>
                  <tr>
                    <th>종료일</th>
                    <td><span className={panel.fieldValue}>{formatDate(selected.endDate)}</span></td>
                  </tr>
                  {selected.paymentConfirmedAt && (
                    <tr>
                      <th>입금 확인일</th>
                      <td><span className={panel.fieldValue}>{formatDate(selected.paymentConfirmedAt)}</span></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 문서 목록 */}
            <div className={panel.detailSection}>
              <div className={panel.detailSectionTitle}>문서 목록</div>
              {detailLoading ? (
                <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  문서를 불러오는 중...
                </div>
              ) : !detail?.documents?.length ? (
                <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  등록된 문서가 없습니다.
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>구분</th>
                        <th>제목</th>
                        <th>상태</th>
                        <th>버전</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.documents.map((doc) => (
                        <tr key={doc.id}>
                          <td>{DOCUMENT_TYPE_META[doc.type]?.label ?? doc.type}</td>
                          <td style={{ fontWeight: 500 }}>{doc.title}</td>
                          <td><StatusBadge status={doc.status} type="document" /></td>
                          <td>v{doc.version}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}