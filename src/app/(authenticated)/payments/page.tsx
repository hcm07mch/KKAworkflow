'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { LuCreditCard, LuExternalLink, LuCheck, LuFileText, LuFileCheck, LuChevronDown, LuChevronRight, LuRotateCcw } from 'react-icons/lu';
import { StatusBadge, useFeedback } from '@/components/ui';
import { SERVICE_TYPE_META, PAYMENT_TYPE_META, DOCUMENT_STATUS_META, PROJECT_STATUS_GROUPS } from '@/lib/domain/types';
import type { ServiceType, ProjectStatus, DocumentStatus, DocumentType } from '@/lib/domain/types';
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
  depositorName: string | null;
}

interface ProjectDocItem {
  id: string;
  type: DocumentType;
  title: string;
  status: DocumentStatus;
  content: any;
  version: number;
  created_at: string;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
}
function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** status 문자열 → 그룹 키(A~G). workflow-builder의 로직과 일치해야 함. */
function statusToGroupKey(status: string): string {
  const g = PROJECT_STATUS_GROUPS.find((grp) => (grp.statuses as readonly string[]).includes(status));
  return g?.key ?? status?.[0] ?? '';
}

/** 연속된 동일 그룹 엔트리를 하나의 세그먼트(=플로우)로 묶음. */
function getGroupSegments(stack: string[]): { key: string; startIdx: number; endIdx: number }[] {
  const segments: { key: string; startIdx: number; endIdx: number }[] = [];
  for (let i = 0; i < stack.length; i++) {
    const key = statusToGroupKey(stack[i]);
    const group = PROJECT_STATUS_GROUPS.find((g) => g.key === key);
    const curIdx = group ? (group.statuses as readonly string[]).indexOf(stack[i]) : -1;
    const last = segments[segments.length - 1];
    if (last && last.key === key) {
      const prevIdx = group ? (group.statuses as readonly string[]).indexOf(stack[last.endIdx]) : -1;
      if (curIdx >= 0 && prevIdx >= 0 && curIdx < prevIdx) {
        segments.push({ key, startIdx: i, endIdx: i });
      } else {
        last.endIdx = i;
      }
    } else {
      segments.push({ key, startIdx: i, endIdx: i });
    }
  }
  return segments;
}

/**
 * 입금 확인 번복 가능 여부.
 * - 이 입금의 D 세그먼트가 workflow_stack의 **마지막 세그먼트**여야 함
 *   (= 입금 플로우 이후에 새로운 플로우가 추가되지 않았음)
 */
function canRevertPayment(stack: string[], flowNumber: number | null): boolean {
  if (!stack || stack.length === 0) return true;
  const segments = getGroupSegments(stack);
  if (segments.length === 0) return true;
  const last = segments[segments.length - 1];
  if (last.key !== 'D') return false;
  if (!flowNumber) return true;
  // 이 입금의 D 세그먼트 순번 == 전체 D 세그먼트 개수여야 함
  const dCount = segments.filter((s) => s.key === 'D').length;
  return flowNumber === dCount;
}

// ── Page ─────────────────────────────────────────────────

export default function PaymentsPage() {
  return (
    <Suspense>
      <PaymentsContent />
    </Suspense>
  );
}

function PaymentsContent() {
  const searchParams = useSearchParams();
  const { toast, confirm, prompt } = useFeedback();
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
  const [projectDocs, setProjectDocs] = useState<ProjectDocItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsExpanded, setDocsExpanded] = useState(true);
  const [projectStack, setProjectStack] = useState<string[]>([]);
  const [reverting, setReverting] = useState(false);

  const selectPayment = useCallback((p: PaymentItem) => {
    setSelected(p);
    localStorage.setItem('payments_selectedId', p.id);
  }, []);

  // 선택된 입금 건의 프로젝트 견적서·계약서 조회
  useEffect(() => {
    if (!selected?.projectId) {
      setProjectDocs([]);
      setProjectStack([]);
      return;
    }
    setDocsLoading(true);
    // 프로젝트 메타데이터 (workflow_stack)
    fetch(`/api/projects/${selected.projectId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((proj: any) => {
        const stack: string[] = (proj?.metadata?.workflow_stack as string[]) ?? [];
        setProjectStack(stack);
      })
      .catch(() => setProjectStack([]));
    // 관련 문서
    fetch(`/api/projects/${selected.projectId}/documents`)
      .then((r) => r.json())
      .then((docs: any[]) => {
        const relevant = (docs ?? [])
          .filter((d: any) => d.type === 'estimate' || d.type === 'contract')
          .map((d: any) => ({
            id: d.id,
            type: d.type as DocumentType,
            title: d.title ?? '',
            status: d.status as DocumentStatus,
            content: d.content ?? {},
            version: d.version ?? 1,
            created_at: d.created_at,
          }));
        setProjectDocs(relevant);
      })
      .catch(() => setProjectDocs([]))
      .finally(() => setDocsLoading(false));
  }, [selected?.projectId]);

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
            flowNumber: d.segment?.flow_number ?? content.flow_number ?? null,
            depositorName: content.depositor_name ?? null,
          };
        });
        setPayments(items);
        setLoading(false);
        const savedId = searchParams.get('selected') ?? localStorage.getItem('payments_selectedId');
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
    const defaultDepositor = (selected.depositorName ?? selected.clientName ?? '').trim();
    const entered = await prompt({
      title: `"${selected.title || selected.clientName}" 입금을 확인 처리하시겠습니까?`,
      input: {
        label: '입금자명 (기본값: 업체명, 수정 가능)',
        placeholder: selected.clientName || '입금자명을 입력하세요',
        defaultValue: defaultDepositor,
        required: true,
      },
    });
    if (entered === null) return;
    const depositor = entered.trim();
    if (!depositor) {
      toast({ title: '입금자명을 입력해주세요', variant: 'error' });
      return;
    }
    setConfirming(true);
    try {
      // 문서 content에 confirmed_at + depositor_name 기록
      const docRes = await fetch(`/api/documents/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: {
            payment_type: selected.paymentType,
            amount: selected.amount,
            months: selected.months,
            flow_number: selected.flowNumber,
            depositor_name: depositor,
            confirmed_at: new Date().toISOString(),
          },
        }),
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
      setPayments((prev) => prev.map((p) => p.id === selected.id ? { ...p, status: 'confirmed' as PaymentStatus, confirmedAt: now, depositorName: depositor } : p));
      setSelected((prev) => prev ? { ...prev, status: 'confirmed' as PaymentStatus, confirmedAt: now, depositorName: depositor } : prev);
      toast({ title: '입금이 확인되었습니다', variant: 'success' });
    } catch {
      toast({ title: '입금 확인에 실패했습니다', variant: 'error' });
    } finally {
      setConfirming(false);
    }
  }

  async function handleRevertPayment() {
    if (!selected || selected.status !== 'confirmed') return;
    if (!canRevertPayment(projectStack, selected.flowNumber)) {
      toast({
        title: '번복할 수 없습니다',
        message: '입금 확인 이후에 새로운 플로우가 추가되어 번복이 불가능합니다.',
        variant: 'error',
      });
      return;
    }
    const ok = await confirm({
      title: `"${selected.title || selected.clientName}" 입금 확인을 번복하시겠습니까?`,
      description: '입금자명·확인일이 제거되고 프로젝트 상태가 "입금 대기"로 되돌아갑니다.',
      variant: 'danger',
      confirmLabel: '번복',
    });
    if (!ok) return;
    setReverting(true);
    try {
      // 문서 content에서 confirmed_at / depositor_name 제거
      const docRes = await fetch(`/api/documents/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: {
            payment_type: selected.paymentType,
            amount: selected.amount,
            months: selected.months,
            flow_number: selected.flowNumber,
          },
        }),
      });
      if (!docRes.ok) throw new Error();
      // 프로젝트 상태를 D1_payment_pending으로 되돌림
      await fetch(`/api/projects/${selected.projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'D1_payment_pending' }),
      });
      setPayments((prev) => prev.map((p) => p.id === selected.id ? { ...p, status: 'pending' as PaymentStatus, confirmedAt: null, depositorName: null } : p));
      setSelected((prev) => prev ? { ...prev, status: 'pending' as PaymentStatus, confirmedAt: null, depositorName: null } : prev);
      toast({ title: '입금 확인이 번복되었습니다', variant: 'success' });
    } catch {
      toast({ title: '번복 처리에 실패했습니다', variant: 'error' });
    } finally {
      setReverting(false);
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
                <span className={panel.itemName}>{p.projectTitle || '(미지정)'}{projectHasSiblings.has(p.projectId) && p.flowNumber ? ` #${p.flowNumber}` : ''}</span>
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
                    <td><span className={panel.fieldValue}><span className={`badge badge-sm ${PAYMENT_STATUS_META[selected.status].badge}`}>{PAYMENT_STATUS_META[selected.status].label}</span></span></td>
                  </tr>
                  <tr>
                    <th>프로젝트</th>
                    <td>
                      <span className={panel.fieldValue}>
                        <a href={`/projects?selected=${selected.projectId}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
                          {selected.projectTitle}
                        </a>
                      </span>
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
                  {selected.status === 'confirmed' && selected.depositorName && (
                    <tr>
                      <th>입금자명</th>
                      <td><span className={panel.fieldValue} style={{ fontWeight: 500 }}>{selected.depositorName}</span></td>
                    </tr>
                  )}
                  <tr>
                    <th>등록일</th>
                    <td><span className={panel.fieldValue}>{formatDate(selected.createdAt)}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 관련 문서 (견적서·계약서) */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setDocsExpanded((v) => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
                  fontWeight: 600, fontSize: 13, color: 'var(--color-text)',
                }}
              >
                {docsExpanded ? <LuChevronDown size={14} /> : <LuChevronRight size={14} />}
                관련 문서 (견적서 · 계약서)
                <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {projectDocs.length}건
                </span>
              </button>
              {docsExpanded && (
                <div style={{ borderTop: '1px solid var(--color-border)' }}>
                  {docsLoading ? (
                    <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>불러오는 중...</div>
                  ) : projectDocs.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>관련 견적서·계약서가 없습니다.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {projectDocs.map((doc) => {
                        const isEstimate = doc.type === 'estimate';
                        const Icon = isEstimate ? LuFileText : LuFileCheck;
                        const typeLabel = isEstimate ? '견적서' : '계약서';
                        const statusMeta = DOCUMENT_STATUS_META[doc.status];
                        const c = doc.content;

                        return (
                          <div
                            key={doc.id}
                            style={{
                              padding: '12px 14px',
                              borderBottom: '1px solid var(--color-border)',
                              fontSize: 13,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                              <Icon size={14} style={{ color: isEstimate ? 'var(--color-primary)' : 'var(--color-warning)' }} />
                              <span style={{ fontWeight: 600 }}>{typeLabel}</span>
                              <span className={`badge badge-sm badge-${statusMeta?.color ?? 'gray'}`} style={{ marginLeft: 4 }}>
                                {statusMeta?.label ?? doc.status}
                              </span>
                              <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)', fontSize: 12 }}>v{doc.version}</span>
                            </div>
                            <div style={{ color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                              {doc.title || '(제목 없음)'}
                            </div>
                            {isEstimate && c && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                                {c.total != null && <span>총액: {formatCurrency(c.total)}</span>}
                                {c.subtotal != null && <span>공급가: {formatCurrency(c.subtotal)}</span>}
                                {c.tax != null && <span>부가세: {formatCurrency(c.tax)}</span>}
                                {c.payment_type && <span>결제: {PAYMENT_TYPE_META[c.payment_type as keyof typeof PAYMENT_TYPE_META]?.label ?? c.payment_type}</span>}
                                {c.items?.length > 0 && <span>항목: {c.items.length}건</span>}
                                {c.valid_until && <span>유효기한: {formatDate(c.valid_until)}</span>}
                              </div>
                            )}
                            {!isEstimate && c && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                                {c.total_amount != null && <span>계약금액: {formatCurrency(c.total_amount)}</span>}
                                {c.contract_date && <span>계약일: {formatDate(c.contract_date)}</span>}
                                {c.effective_date && <span>시작일: {formatDate(c.effective_date)}</span>}
                                {c.expiry_date && <span>종료일: {formatDate(c.expiry_date)}</span>}
                                {c.payment_type && <span>결제: {PAYMENT_TYPE_META[c.payment_type as keyof typeof PAYMENT_TYPE_META]?.label ?? c.payment_type}</span>}
                                {c.file_name && <span>파일: {c.file_name}</span>}
                              </div>
                            )}
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                              등록일: {formatDate(doc.created_at)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
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

            {/* 입금 확인 번복 버튼 (D 세그먼트가 마지막일 때만 활성) */}
            {selected.status === 'confirmed' && (() => {
              const revertable = canRevertPayment(projectStack, selected.flowNumber);
              return (
                <div style={{ padding: '16px 0' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '10px 0',
                      fontWeight: 600,
                      opacity: revertable ? 1 : 0.55,
                      cursor: revertable ? 'pointer' : 'not-allowed',
                    }}
                    onClick={handleRevertPayment}
                    disabled={reverting || !revertable}
                    title={revertable ? '입금 확인을 번복합니다' : '입금 이후에 새 플로우가 추가되어 번복할 수 없습니다'}
                  >
                    <LuRotateCcw size={16} />
                    {reverting ? '처리 중...' : '입금 확인 번복'}
                  </button>
                  {!revertable && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                      입금 이후 새로운 플로우가 추가되어 번복할 수 없습니다.
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}