'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  LuInbox, LuPhone, LuRefreshCw, LuTrash2, LuCopy, LuMessageSquare,
  LuClock, LuLink, LuChevronRight, LuStickyNote, LuUser, LuCheck,
} from 'react-icons/lu';
import { ActionButton, useFeedback } from '@/components/ui';
import panel from '../panel-layout.module.css';
import styles from './landing-inquiries.module.css';

// ── Types ────────────────────────────────────────────────

type InquiryStatus = 'new' | 'contacted' | 'closed' | 'spam';

interface Inquiry {
  id: string;
  name: string | null;
  phone: string;
  industry: string | null;
  message: string | null;
  status: InquiryStatus;
  admin_note: string | null;
  handled_by: string | null;
  handled_at: string | null;
  source: string | null;
  user_agent: string | null;
  ip_address: string | null;
  referrer: string | null;
  created_at: string;
  updated_at: string;
}

interface Member {
  id: string;
  auth_id: string | null;
  name: string | null;
  email?: string | null;
}

interface CurrentUser {
  id: string;
  name: string | null;
  role: string;
}

const STATUS_META: Record<
  InquiryStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  new:       { label: '신규',     badgeClass: 'badge-blue',   dotClass: styles.dotNew },
  contacted: { label: '연락 완료', badgeClass: 'badge-yellow', dotClass: styles.dotContacted },
  closed:    { label: '종료',     badgeClass: 'badge-green',  dotClass: styles.dotClosed },
  spam:      { label: '스팸',     badgeClass: 'badge-gray',   dotClass: styles.dotSpam },
};

const STATUS_ORDER: InquiryStatus[] = ['new', 'contacted', 'closed', 'spam'];

// ── Helpers ──────────────────────────────────────────────

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function relativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}일 전`;
  const diffMo = Math.floor(diffDay / 30);
  if (diffMo < 12) return `${diffMo}개월 전`;
  return `${Math.floor(diffMo / 12)}년 전`;
}

function getInitial(name: string | null, phone: string): string {
  const n = name?.trim();
  if (n) return n.charAt(0).toUpperCase();
  return phone.slice(-2, -1) || '?';
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone;
}

// ── Page ─────────────────────────────────────────────────

export default function LandingInquiriesPage() {
  const { confirm, toast } = useFeedback();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InquiryStatus>('all');
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState<InquiryStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // 멤버 이름 표시용 + 현재 사용자(헤더 hint) 1회 로드
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => { if (u) setCurrentUser(u); })
      .catch(() => {});
    fetch('/api/settings/members?all=1')
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (Array.isArray(list)) setMembers(list);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/landing-inquiries')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? '문의 목록을 불러오지 못했습니다');
        }
        return res.json();
      })
      .then((data: Inquiry[]) => {
        setInquiries(data);
        setSelected((prev) => {
          if (!prev) return prev;
          const fresh = data.find((d) => d.id === prev.id);
          return fresh ?? null;
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setNoteDraft(selected?.admin_note ?? '');
  }, [selected?.id, selected?.admin_note]);

  // landing_inquiries.handled_by 는 auth.users(id) 외래키이므로 workflow_users.auth_id 로 매칭
  const memberByAuthId = useMemo(() => {
    const map = new Map<string, Member>();
    for (const m of members) {
      if (m.auth_id) map.set(m.auth_id, m);
    }
    return map;
  }, [members]);

  function handlerName(authId: string | null | undefined): string {
    if (!authId) return '미지정';
    return memberByAuthId.get(authId)?.name?.trim() || `${authId.slice(0, 8)}…`;
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inquiries.filter((it) => {
      if (statusFilter !== 'all' && it.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (it.name ?? '').toLowerCase().includes(q) ||
        it.phone.toLowerCase().includes(q) ||
        (it.industry ?? '').toLowerCase().includes(q) ||
        (it.message ?? '').toLowerCase().includes(q)
      );
    });
  }, [inquiries, search, statusFilter]);

  const counts = useMemo(() => {
    const acc: Record<InquiryStatus | 'all', number> = {
      all: inquiries.length, new: 0, contacted: 0, closed: 0, spam: 0,
    };
    for (const it of inquiries) acc[it.status] += 1;
    return acc;
  }, [inquiries]);

  async function updateInquiry(
    id: string,
    patch: { status?: InquiryStatus; admin_note?: string },
  ) {
    if (patch.status) setStatusSaving(patch.status);
    if (patch.admin_note !== undefined) setSaving(true);
    try {
      const res = await fetch(`/api/landing-inquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? '저장에 실패했습니다');
      }
      const updated: Inquiry = await res.json();
      setInquiries((list) => list.map((it) => (it.id === id ? updated : it)));
      setSelected(updated);
      if (patch.status) {
        const handlerLabel = updated.handled_by ? ` · 처리자 ${handlerName(updated.handled_by)}` : '';
        toast({
          title: `상태가 "${STATUS_META[patch.status].label}"(으)로 변경되었습니다${handlerLabel}`,
          variant: 'success',
        });
      } else if (patch.admin_note !== undefined) {
        toast({ title: '메모가 저장되었습니다', variant: 'success' });
      }
    } catch (e) {
      toast({
        title: '저장 실패',
        description: e instanceof Error ? e.message : String(e),
        variant: 'error',
      });
    } finally {
      setSaving(false);
      setStatusSaving(null);
    }
  }

  async function deleteInquiry(id: string) {
    const ok = await confirm({
      title: '이 문의를 삭제하시겠습니까?',
      description: '삭제된 문의는 복구할 수 없습니다.',
      variant: 'danger',
      confirmLabel: '삭제',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/landing-inquiries/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? '삭제에 실패했습니다');
      }
      setInquiries((list) => list.filter((it) => it.id !== id));
      setSelected(null);
      toast({ title: '문의가 삭제되었습니다', variant: 'success' });
    } catch (e) {
      toast({
        title: '삭제 실패',
        description: e instanceof Error ? e.message : String(e),
        variant: 'error',
      });
    } finally {
      setDeleting(false);
    }
  }

  async function copyToClipboard(text: string, key: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1400);
      toast({ title: `${label}이(가) 복사되었습니다`, variant: 'success' });
    } catch {
      toast({ title: '복사에 실패했습니다', variant: 'error' });
    }
  }

  const noteDirty = !!selected && noteDraft !== (selected.admin_note ?? '');

  return (
    <div className={panel.wrapper}>
      {/* ── Left Panel: Filters + List ── */}
      <aside className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <div className={panel.leftTitleRow}>
            <div className={panel.leftTitle}>랜딩 문의</div>
            <button
              type="button"
              className={panel.expandBtn}
              onClick={load}
              title="새로고침"
              aria-label="새로고침"
            >
              <LuRefreshCw size={14} />
            </button>
          </div>
          <input
            className={panel.searchInput}
            placeholder="이름·연락처·메시지 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={panel.filterTabs}>
            {(['all', ...STATUS_ORDER] as const).map((key) => (
              <button
                key={key}
                type="button"
                className={`${panel.filterTab} ${statusFilter === key ? panel.filterTabActive : ''}`}
                onClick={() => setStatusFilter(key)}
              >
                {key === 'all' ? '전체' : STATUS_META[key].label} ({counts[key]})
              </button>
            ))}
          </div>
        </div>

        <div className={panel.itemList}>
          {loading ? (
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={panel.skeletonItem}>
                  <div className={panel.skeletonBar} style={{ width: '60%' }} />
                  <div className={panel.skeletonBar} style={{ width: '40%' }} />
                </div>
              ))}
            </>
          ) : filtered.length === 0 ? (
            <div className={panel.emptyState}>
              <LuInbox className={panel.emptyIcon} />
              <div>표시할 문의가 없습니다</div>
            </div>
          ) : (
            filtered.map((it) => (
              <div
                key={it.id}
                className={`${panel.item} ${selected?.id === it.id ? panel.itemActive : ''}`}
                onClick={() => setSelected(it)}
              >
                <div className={panel.itemNameRow}>
                  <span className={panel.itemName}>
                    {it.name?.trim() || '(이름 미입력)'}
                  </span>
                  <span className={panel.itemBadge}>
                    <span className={`badge ${STATUS_META[it.status].badgeClass} badge-sm`}>
                      {STATUS_META[it.status].label}
                    </span>
                  </span>
                </div>
                <div className={panel.itemMeta}>
                  <LuPhone size={11} />
                  <span>{formatPhone(it.phone)}</span>
                  {it.industry ? <span>· {it.industry}</span> : null}
                </div>
                <div className={panel.itemMeta}>
                  <LuClock size={11} />
                  <span>{relativeTime(it.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={panel.leftFooter}>총 {inquiries.length}건</div>
      </aside>

      {/* ── Right Panel: Detail ── */}
      <main className={panel.rightPanel}>
        {error ? (
          <div className={panel.emptyState}>
            <div style={{ color: 'var(--color-secondary)' }}>{error}</div>
            <ActionButton variant="secondary" onClick={load} label="다시 시도" />
          </div>
        ) : !selected ? (
          <div className={panel.emptyState}>
            <LuInbox className={panel.emptyIcon} />
            <div>왼쪽 목록에서 문의를 선택하세요</div>
          </div>
        ) : (
          <div className={styles.detailStack}>
            {/* ── Hero ── */}
            <div className={styles.hero}>
              <div className={styles.avatar} aria-hidden>
                {getInitial(selected.name, selected.phone)}
              </div>
              <div className={styles.heroBody}>
                <div className={styles.heroTitleRow}>
                  <span className={styles.heroName}>
                    {selected.name?.trim() || '(이름 미입력)'}
                  </span>
                  <span className={`badge ${STATUS_META[selected.status].badgeClass} badge-md`}>
                    {STATUS_META[selected.status].label}
                  </span>
                </div>
                <div className={styles.heroMeta}>
                  <span title={formatDateTime(selected.created_at)}>
                    {relativeTime(selected.created_at)} 접수
                  </span>
                  <span className={styles.heroMetaDot} />
                  <span>{formatDate(selected.created_at)}</span>
                  <span className={styles.heroMetaDot} />
                  <span>{selected.source ?? 'landing'}</span>
                  {selected.industry ? (
                    <>
                      <span className={styles.heroMetaDot} />
                      <span>{selected.industry}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className={styles.heroActions}>
                <ActionButton
                  variant="danger"
                  onClick={() => deleteInquiry(selected.id)}
                  disabled={deleting}
                  loading={deleting}
                  icon={<LuTrash2 size={14} />}
                  label="삭제"
                />
              </div>
            </div>

            {/* ── Quick Actions ── */}
            <div className={styles.quickRow}>
              <div className={styles.phoneBlock}>
                <span className={styles.phoneLabel}>연락처</span>
                <span className={styles.phoneValue}>{formatPhone(selected.phone)}</span>
              </div>
              <a
                href={`tel:${selected.phone}`}
                className={`${styles.iconBtn} ${styles.iconBtnPrimary}`}
                title="전화 걸기"
              >
                <LuPhone size={14} /> 전화
              </a>
              <a
                href={`sms:${selected.phone}`}
                className={styles.iconBtn}
                title="문자 보내기"
              >
                <LuMessageSquare size={14} /> 문자
              </a>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => copyToClipboard(selected.phone, 'phone', '연락처')}
                title="번호 복사"
              >
                {copiedKey === 'phone' ? <LuCheck size={14} /> : <LuCopy size={14} />}
                {copiedKey === 'phone' ? '복사됨' : '복사'}
              </button>
            </div>

            {/* ── Status Switcher ── */}
            <div className={styles.statusCard}>
              <div className={styles.statusCardHeader}>
                <span className={styles.statusCardTitle}>상태 관리</span>
                <span className={styles.statusCardHint}>
                  {selected.handled_at
                    ? `처리: ${handlerName(selected.handled_by)} · ${formatDateTime(selected.handled_at)}`
                    : '아직 처리되지 않음'}
                </span>
              </div>

              <div className={styles.segments} role="tablist" aria-label="상태">
                {STATUS_ORDER.map((s) => {
                  const active = selected.status === s;
                  const isSavingThis = statusSaving === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`${styles.segment} ${active ? styles.segmentActive : ''}`}
                      onClick={() => {
                        if (active) return;
                        updateInquiry(selected.id, { status: s });
                      }}
                      disabled={!!statusSaving || active}
                    >
                      <span className={`${styles.segmentDot} ${STATUS_META[s].dotClass}`} />
                      {STATUS_META[s].label}
                      {isSavingThis ? '…' : ''}
                    </button>
                  );
                })}
              </div>
              <div className={styles.statusHelp}>
                상태 변경 시 처리자는 현재 로그인 계정
                {currentUser?.name ? <strong>「{currentUser.name}」</strong> : null}
                (으)로 자동 기록됩니다.
              </div>
            </div>

            {/* ── Message ── */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>
                  <span className={styles.cardTitleIcon}><LuMessageSquare size={14} /></span>
                  문의 내용
                </span>
                {selected.message?.trim() ? (
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => copyToClipboard(selected.message ?? '', 'message', '문의 내용')}
                  >
                    {copiedKey === 'message' ? <LuCheck size={14} /> : <LuCopy size={14} />}
                    복사
                  </button>
                ) : null}
              </div>
              <div className={styles.messageBox}>
                {selected.message?.trim() ? (
                  selected.message
                ) : (
                  <span className={styles.messageEmpty}>(내용 없음)</span>
                )}
              </div>
            </div>

            {/* ── Admin Note ── */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>
                  <span className={styles.cardTitleIcon}><LuStickyNote size={14} /></span>
                  관리자 메모
                </span>
                <span className={styles.cardSubtle}>
                  {noteDraft.length} / 2000
                </span>
              </div>
              <textarea
                className={styles.noteEditor}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value.slice(0, 2000))}
                rows={4}
                placeholder="처리 결과·통화 메모 등을 기록하세요"
              />
              <div className={styles.noteFooter}>
                <span
                  className={`${styles.noteStatus} ${noteDirty ? styles.noteStatusDirty : ''}`}
                >
                  {saving
                    ? '저장 중…'
                    : noteDirty
                    ? '저장되지 않은 변경사항이 있습니다'
                    : selected.admin_note
                    ? `최종 수정 ${relativeTime(selected.updated_at)}`
                    : '메모 없음'}
                </span>
                <div className={styles.noteActions}>
                  <ActionButton
                    variant="secondary"
                    onClick={() => setNoteDraft(selected.admin_note ?? '')}
                    disabled={saving || !noteDirty}
                    label="취소"
                  />
                  <ActionButton
                    variant="primary"
                    onClick={() => updateInquiry(selected.id, { admin_note: noteDraft })}
                    disabled={saving || !noteDirty}
                    loading={saving}
                    label="메모 저장"
                  />
                </div>
              </div>
            </div>

            {/* ── Trace (collapsible) ── */}
            <button
              type="button"
              className={styles.traceToggle}
              onClick={() => setTraceOpen((o) => !o)}
              aria-expanded={traceOpen}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <LuLink size={14} /> 유입 정보
              </span>
              <LuChevronRight
                size={14}
                className={`${styles.traceToggleIcon} ${traceOpen ? styles.traceToggleIconOpen : ''}`}
              />
            </button>
            {traceOpen ? (
              <div className={styles.traceContent}>
                <div className={styles.metaGrid}>
                  <div className={styles.metaField}>
                    <span className={styles.metaLabel}>유입 경로</span>
                    <span className={styles.metaValue}>
                      {selected.referrer ? (
                        <a
                          href={selected.referrer}
                          target="_blank"
                          rel="noreferrer noopener"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          {selected.referrer}
                        </a>
                      ) : (
                        <span className={styles.metaValueMuted}>-</span>
                      )}
                    </span>
                  </div>
                  <div className={styles.metaField}>
                    <span className={styles.metaLabel}>IP 주소</span>
                    <span className={styles.metaValue}>
                      {selected.ip_address || (
                        <span className={styles.metaValueMuted}>-</span>
                      )}
                    </span>
                  </div>
                  <div className={styles.metaField}>
                    <span className={styles.metaLabel}>처리자</span>
                    <span className={styles.metaValue}>
                      {selected.handled_by ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <LuUser size={12} />
                          {handlerName(selected.handled_by)}
                        </span>
                      ) : (
                        <span className={styles.metaValueMuted}>미지정</span>
                      )}
                    </span>
                  </div>
                  <div className={styles.metaField}>
                    <span className={styles.metaLabel}>처리 일시</span>
                    <span className={styles.metaValue}>
                      {selected.handled_at ? (
                        formatDateTime(selected.handled_at)
                      ) : (
                        <span className={styles.metaValueMuted}>-</span>
                      )}
                    </span>
                  </div>
                  <div className={styles.metaField}>
                    <span className={styles.metaLabel}>접수 일시</span>
                    <span className={styles.metaValue}>
                      {formatDateTime(selected.created_at)}
                    </span>
                  </div>
                  <div className={styles.metaField}>
                    <span className={styles.metaLabel}>최종 수정</span>
                    <span className={styles.metaValue}>
                      {formatDateTime(selected.updated_at)}
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <span className={styles.metaLabel}>User Agent</span>
                  <div className={styles.traceUA}>
                    {selected.user_agent || '-'}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
