'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  LuInbox, LuPhone, LuRefreshCw, LuTrash2, LuCopy, LuMessageSquare,
  LuClock, LuLink, LuChevronRight, LuStickyNote, LuUser, LuCheck,
  LuBriefcase, LuMapPin, LuPlus, LuBuilding2, LuPencil, LuChevronLeft,
} from 'react-icons/lu';
import { ActionButton, useFeedback } from '@/components/ui';
import { LuArrowRight, LuHistory } from 'react-icons/lu';
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
  region: string | null;
  organization_id: string | null;
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
  new:       { label: '신규',     badgeClass: 'badge-indigo',   dotClass: styles.dotNew },
  contacted: { label: '연락 완료', badgeClass: 'badge-yellow', dotClass: styles.dotContacted },
  closed:    { label: '종료',     badgeClass: 'badge-green',  dotClass: styles.dotClosed },
  spam:      { label: '스팸',     badgeClass: 'badge-red',    dotClass: styles.dotSpam },
};

const STATUS_ORDER: InquiryStatus[] = ['new', 'contacted', 'closed', 'spam'];

// 지역: 광역/도 단위 17개 시·도
const REGION_OPTIONS = [
  '서울특별시', '경기도', '인천광역시', '강원특별자치도',
  '충청북도', '충청남도', '대전광역시', '세종특별자치시',
  '전라북도', '전라남도', '광주광역시',
  '경상북도', '경상남도', '대구광역시', '부산광역시', '울산광역시',
  '제주특별자치도',
] as const;

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

interface TransferRecord {
  id: string;
  inquiry_id: string;
  from_organization_id: string | null;
  from_organization_name: string | null;
  to_organization_id: string | null;
  to_organization_name: string | null;
  transferred_by: string | null;
  transferred_by_name: string | null;
  note: string | null;
  created_at: string;
}

// ── Inline Editable Field ────────────────────────────────────────────────
interface EditableInlineProps {
  value: string | null;
  onCommit: (next: string) => void;
  displayValue?: React.ReactNode;
  placeholder?: string;
  emptyPlaceholder?: string;
  required?: boolean;
  maxLength?: number;
  inputMode?: 'text' | 'tel';
  ariaLabel: string;
  viewClassName?: string;
  inputClassName?: string;
  confirmLabel?: string;
}

function EditableInline({
  value,
  onCommit,
  displayValue,
  placeholder,
  emptyPlaceholder,
  required = false,
  maxLength,
  inputMode = 'text',
  ariaLabel,
  viewClassName,
  inputClassName,
  confirmLabel,
}: EditableInlineProps) {
  const { confirm } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value ?? '');
  }, [value, editing]);

  async function commit() {
    const next = draft.trim();
    setEditing(false);
    if (required && next === '') {
      setDraft(value ?? '');
      return;
    }
    if (next === (value ?? '').trim()) return;
    const label = confirmLabel ?? ariaLabel;
    const prev = (value ?? '').trim();
    const ok = await confirm({
      title: `${label} 변경`,
      description: `${label}을(를) "${prev || '(비어 있음)'}" → "${next || '(비어 있음)'}" (으)로 변경하시겠습니까?`,
      confirmLabel: '저장',
      cancelLabel: '취소',
    });
    if (!ok) {
      setDraft(value ?? '');
      return;
    }
    onCommit(next);
  }

  function cancel() {
    setDraft(value ?? '');
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        className={inputClassName}
        value={draft}
        onChange={(e) =>
          setDraft(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)
        }
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-label={ariaLabel}
      />
    );
  }

  const hasValue = !!(value && value.trim());
  return (
    <span className={viewClassName}>
      <span>
        {hasValue ? displayValue ?? value : emptyPlaceholder ?? '-'}
      </span>
      <button
        type="button"
        className={styles.editablePencilBtn}
        onClick={() => setEditing(true)}
        title="편집"
        aria-label={`${ariaLabel} 편집`}
      >
        <LuPencil size={11} className={styles.editablePencil} aria-hidden />
      </button>
    </span>
  );
}

export default function LandingInquiriesPage() {
  const { confirm, prompt, toast } = useFeedback();
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
  const [transferHistoryOpen, setTransferHistoryOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [orgInfo, setOrgInfo] = useState<{ id: string; name: string; parent_id: string | null } | null>(null);
  const [childOrgs, setChildOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [orgSaving, setOrgSaving] = useState(false);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [mode, setMode] = useState<'view' | 'new'>('view');
  const emptyForm = {
    name: '',
    phone: '',
    industry: '',
    region: '',
    message: '',
    admin_note: '',
    source: '수동 입력',
    organization_id: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

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
    Promise.all([
      fetch('/api/settings/org').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/settings/departments').then((r) => (r.ok ? r.json() : [])),
    ]).then(([org, depts]) => {
      if (org) setOrgInfo({ id: org.id, name: org.name, parent_id: org.parent_id ?? null });
      setChildOrgs((depts ?? []).map((d: any) => ({ id: d.id, name: d.name })));
    }).catch(() => {});
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

  const loadTransfers = useCallback(async (inquiryId: string) => {
    setTransfersLoading(true);
    try {
      const res = await fetch(`/api/landing-inquiries/${inquiryId}/transfers`);
      if (!res.ok) {
        // 권한 없음(403) 등은 조용히 무시
        setTransfers([]);
        return;
      }
      const data: TransferRecord[] = await res.json();
      setTransfers(Array.isArray(data) ? data : []);
    } catch {
      setTransfers([]);
    } finally {
      setTransfersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected?.id) loadTransfers(selected.id);
    else setTransfers([]);
  }, [selected?.id, loadTransfers]);

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

  const allowedOrgOptions = useMemo(
    () => (orgInfo ? [{ id: orgInfo.id, name: orgInfo.name }, ...childOrgs] : []),
    [orgInfo, childOrgs],
  );

  function orgName(orgId: string | null | undefined): string {
    if (!orgId) return '미지정';
    return allowedOrgOptions.find((o) => o.id === orgId)?.name ?? '미지정';
  }

  async function updateInquiryOrg(id: string, newOrgId: string) {
    if (!newOrgId) return;
    const currentOrgId = selected?.organization_id ?? null;
    if (newOrgId === currentOrgId) return;
    const fromLabel = orgName(currentOrgId);
    const toLabel = orgName(newOrgId);
    const note = await prompt({
      title: '이 문의를 다른 조직으로 이전하시겠습니까?',
      description: `"${fromLabel}" → "${toLabel}"이전 사유를 남기면\n 이력에서 함께 확인할 수 있습니다.`,

      variant: 'warning',
      confirmLabel: '이전',
      input: { label: '이전 사유 (선택)', placeholder: '예: 담당 지역 변경', required: false },
    });
    if (note === null) return;
    setOrgSaving(true);
    try {
      const res = await fetch(`/api/landing-inquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: newOrgId, transfer_note: note || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? '소속 조직 변경에 실패했습니다');
      }
      const updated: Inquiry = await res.json();
      setInquiries((list) => list.map((it) => (it.id === id ? updated : it)));
      setSelected(updated);
      // 이전 이력 갱신
      loadTransfers(updated.id);
      toast({
        title: `소속 조직이 "${orgName(updated.organization_id)}"(으)로 변경되었습니다`,
        variant: 'success',
      });
    } catch (e) {
      toast({
        title: '소속 조직 변경 실패',
        message: e instanceof Error ? e.message : String(e),
        variant: 'error',
      });
    } finally {
      setOrgSaving(false);
    }
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
        (it.region ?? '').toLowerCase().includes(q) ||
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
    patch: {
      status?: InquiryStatus;
      admin_note?: string;
      name?: string | null;
      phone?: string;
      industry?: string | null;
      region?: string | null;
    },
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
      } else if (
        patch.name !== undefined ||
        patch.phone !== undefined ||
        patch.industry !== undefined ||
        patch.region !== undefined
      ) {
        const fieldLabel =
          patch.name !== undefined
            ? '이름'
            : patch.phone !== undefined
            ? '연락처'
            : patch.industry !== undefined
            ? '업종'
            : '지역';
        toast({ title: `${fieldLabel}이(가) 저장되었습니다`, variant: 'success' });
      }
    } catch (e) {
      toast({
        title: '저장 실패',
        message: e instanceof Error ? e.message : String(e),
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
        message: e instanceof Error ? e.message : String(e),
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

  function updateForm<K extends keyof typeof emptyForm>(field: K, value: (typeof emptyForm)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function startNew() {
    setMode('new');
    setSelected(null);
    setForm({ ...emptyForm, organization_id: orgInfo?.id ?? '' });
    setFormError('');
  }

  function cancelNew() {
    setMode('view');
    setFormError('');
  }

  async function handleCreate() {
    const phone = form.phone.trim();
    if (!phone) {
      setFormError('연락처는 필수입니다');
      return;
    }
    setCreating(true);
    setFormError('');
    try {
      const res = await fetch('/api/landing-inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || null,
          phone,
          industry: form.industry.trim() || null,
          region: form.region.trim() || null,
          message: form.message.trim() || null,
          admin_note: form.admin_note.trim() || null,
          source: form.source.trim() || 'manual',
          organization_id: form.organization_id || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? '등록에 실패했습니다');
      }
      const created: Inquiry = await res.json();
      setInquiries((list) => [created, ...list]);
      setSelected(created);
      setMode('view');
      setForm(emptyForm);
      toast({ title: '문의가 등록되었습니다', variant: 'success' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setFormError(msg);
      toast({ title: '등록 실패', message: msg, variant: 'error' });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={panel.wrapper}>
      {/* ── Left Panel: Filters + List ── */}
      <aside className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <div className={panel.leftTitleRow}>
            <div className={panel.leftTitle}>랜딩 DB</div>
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
            placeholder="이름·연락처·지역·메시지 검색"
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
          <div className={panel.addItem} onClick={startNew}>
            <LuPlus size={14} /> 새 문의 등록
          </div>
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
                className={`${panel.item} ${styles.listItem} ${selected?.id === it.id && mode !== 'new' ? panel.itemActive : ''}`}
                onClick={() => { setMode('view'); setSelected(it); }}
              >
                <div className={`${panel.itemNameRow} ${styles.listNameRow}`}>
                  <span className={`${panel.itemName} ${styles.listName}`}>
                    {it.name?.trim() || '(이름 미입력)'}
                  </span>
                  {(it.industry || it.region) ? (
                    <div className={`${styles.chipRow} ${styles.chipRowInline}`}>
                      {it.industry ? (
                        <span className={`${styles.chip} ${styles.chipIndustry} ${styles.chipSm}`}>
                          <LuBriefcase size={10} className={styles.chipIcon} />
                          {it.industry}
                        </span>
                      ) : null}
                      {it.region ? (
                        <span className={`${styles.chip} ${styles.chipRegion} ${styles.chipSm}`}>
                          <LuMapPin size={10} className={styles.chipIcon} />
                          {it.region}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <span className={`${panel.itemBadge} ${styles.listBadge}`}>
                    <span className={`badge ${STATUS_META[it.status].badgeClass} badge-sm`}>
                      {STATUS_META[it.status].label}
                    </span>
                  </span>
                </div>
                <div className={styles.listPhoneRow}>
                  <span className={styles.listPhone}>
                    <LuPhone size={13} />
                    {formatPhone(it.phone)}
                  </span>
                  <span className={styles.listTime} title={formatDateTime(it.created_at)}>
                    {relativeTime(it.created_at)}
                  </span>
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
        ) : mode === 'new' ? (
          <>
            <button type="button" className={panel.mobileBack} onClick={cancelNew}>
              <LuChevronLeft size={16} /> 목록
            </button>
            <span className={panel.mobileBackTitle}>새 문의 등록</span>
            <div className={panel.detailHeader}>
              <div>
                <div className={panel.detailTitle}>새 문의 등록</div>
                <div className={panel.detailSubtitle}>전화·대면 등으로 접수된 문의를 수동으로 등록하세요.</div>
              </div>
              <div className={panel.detailActions}>
                <ActionButton label="취소" variant="ghost" size="sm" onClick={cancelNew} />
                <ActionButton
                  label={creating ? '등록 중…' : '등록'}
                  variant="primary"
                  size="sm"
                  onClick={handleCreate}
                  disabled={creating}
                  loading={creating}
                />
              </div>
            </div>

            {formError && (
              <div style={{ padding: '10px 14px', marginBottom: 16, background: '#fee2e2', color: '#b91c1c', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                {formError}
              </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className={panel.formTable}>
                <tbody>
                  {allowedOrgOptions.length > 1 ? (
                    <tr>
                      <th>소속 조직</th>
                      <td>
                        <select
                          value={form.organization_id}
                          onChange={(e) => updateForm('organization_id', e.target.value)}
                        >
                          {allowedOrgOptions.map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ) : null}
                  <tr className={panel.requiredRow}>
                    <th>연락처</th>
                    <td>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => updateForm('phone', e.target.value)}
                        placeholder="010-1234-5678"
                        autoFocus
                      />
                    </td>
                  </tr>
                  <tr>
                    <th>이름</th>
                    <td>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => updateForm('name', e.target.value)}
                        placeholder="고객명"
                      />
                    </td>
                  </tr>
                  <tr>
                    <th>업종</th>
                    <td>
                      <input
                        type="text"
                        value={form.industry}
                        onChange={(e) => updateForm('industry', e.target.value)}
                        placeholder="예: 식당, 의료, 서비스"
                      />
                    </td>
                  </tr>
                  <tr>
                    <th>지역</th>
                    <td>
                      <select
                        value={form.region}
                        onChange={(e) => updateForm('region', e.target.value)}
                      >
                        <option value="">선택 안 함</option>
                        {REGION_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <th>유입 경로</th>
                    <td>
                      <input
                        type="text"
                        value={form.source}
                        onChange={(e) => updateForm('source', e.target.value)}
                        placeholder="예: 수기 입력, 전화, 추천, 랜딩 페이지"
                      />
                    </td>
                  </tr>
                  <tr>
                    <th>문의 내용</th>
                    <td>
                      <textarea
                        value={form.message}
                        onChange={(e) => updateForm('message', e.target.value)}
                        rows={4}
                        style={{ resize: 'vertical' }}
                        placeholder="고객이 문의한 내용을 입력하세요"
                      />
                    </td>
                  </tr>
                  <tr>
                    <th>관리자 메모</th>
                    <td>
                      <textarea
                        value={form.admin_note}
                        onChange={(e) => updateForm('admin_note', e.target.value.slice(0, 2000))}
                        rows={3}
                        style={{ resize: 'vertical' }}
                        placeholder="통화 메모·해장 메모 등"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : !selected ? (
          <div className={panel.emptyState}>
            <LuInbox className={panel.emptyIcon} />
            <div>왼쪽 목록에서 문의를 선택하세요</div>
          </div>
        ) : (
          <>
            <button type="button" className={panel.mobileBack} onClick={() => setSelected(null)}>
              <LuChevronLeft size={16} /> 목록
            </button>
            <span className={panel.mobileBackTitle}>
              {selected.name?.trim() || formatPhone(selected.phone)}
            </span>
            {/* ── Detail Header ── */}
            <div className={panel.detailHeader}>
              <div style={{ minWidth: 0 }}>
                <div className={panel.detailTitle} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <EditableInline
                    value={selected.name}
                    onCommit={(next) => updateInquiry(selected.id, { name: next === '' ? null : next })}
                    emptyPlaceholder="(이름 미입력)"
                    ariaLabel="이름"
                    maxLength={100}
                    viewClassName={styles.editableTitle}
                    inputClassName={styles.editableTitleInput}
                  />
                  <span className={`badge ${STATUS_META[selected.status].badgeClass} badge-md`}>
                    {STATUS_META[selected.status].label}
                  </span>
                </div>
                <div className={panel.detailSubtitle} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  <span title={formatDateTime(selected.created_at)}>
                    {relativeTime(selected.created_at)} 접수
                  </span>
                  <span className={styles.heroMetaDot} />
                  <span>{formatDate(selected.created_at)}</span>
                  <span className={styles.heroMetaDot} />
                  <span>{selected.source ?? 'landing'}</span>
                </div>
              </div>
              <div className={panel.detailActions}>
                <ActionButton
                  variant="danger"
                  size="sm"
                  onClick={() => deleteInquiry(selected.id)}
                  disabled={deleting}
                  loading={deleting}
                  icon={<LuTrash2 size={14} />}
                  label="삭제"
                />
              </div>
            </div>

            {/* ── Main Field Table ── */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className={panel.formTable}>
                <tbody>
                  <tr>
                    <th>소속 조직</th>
                    <td>
                      <div className={styles.tableCellPad}>
                        {allowedOrgOptions.length > 1 ? (
                          <div className={styles.orgChipGroup} role="radiogroup" aria-label="소속 조직 선택">
                            {allowedOrgOptions.map((o) => {
                              const isActive = o.id === selected.organization_id;
                              return (
                                <button
                                  key={o.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={isActive}
                                  disabled={orgSaving || isActive}
                                  onClick={() => {
                                    if (!isActive) updateInquiryOrg(selected.id, o.id);
                                  }}
                                  className={`${styles.orgChip} ${isActive ? styles.orgChipActive : ''}`}
                                  title={o.name}
                                >
                                  <LuBuilding2 size={11} />
                                  <span>{o.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className={panel.fieldValue} style={{ padding: 0 }}>
                            <LuBuilding2 size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                            {orgName(selected.organization_id)}
                          </span>
                        )}
                        {transfers.length > 0 ? (
                          <div className={styles.transferHistory}>
                            <button
                              type="button"
                              className={styles.transferHistoryToggle}
                              onClick={() => setTransferHistoryOpen((o) => !o)}
                              aria-expanded={transferHistoryOpen}
                            >
                              <span className={styles.transferHistoryToggleLabel}>
                                <LuHistory size={12} />
                                이전 이력 ({transfers.length})
                              </span>
                              <LuChevronRight
                                size={12}
                                className={`${styles.traceToggleIcon} ${transferHistoryOpen ? styles.traceToggleIconOpen : ''}`}
                              />
                            </button>
                            {transferHistoryOpen ? (
                              <div className={styles.transferTableWrap}>
                                <table className={styles.transferTable}>
                                  <thead>
                                    <tr>
                                      <th>이전</th>
                                      <th>작업자</th>
                                      <th>사유</th>
                                      <th>시각</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {transfers.map((t) => (
                                      <tr key={t.id}>
                                        <td className={styles.transferCellOrg}>
                                          <span>{t.from_organization_name ?? '-'}</span>
                                          <LuArrowRight size={10} className={styles.transferArrow} />
                                          <span>{t.to_organization_name ?? '-'}</span>
                                        </td>
                                        <td className={styles.transferCellUser}>
                                          {t.transferred_by_name?.trim() || '시스템'}
                                        </td>
                                        <td
                                          className={styles.transferCellNote}
                                          title={t.note ?? ''}
                                        >
                                          {t.note?.trim() || '-'}
                                        </td>
                                        <td
                                          className={styles.transferCellTime}
                                          title={formatDateTime(t.created_at)}
                                        >
                                          {relativeTime(t.created_at)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <th>상태</th>
                    <td>
                      <div className={styles.tableCellPad}>
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
                        <div className={styles.statusHelp} style={{ marginTop: 8 }}>
                          {selected.handled_at
                            ? `처리: ${handlerName(selected.handled_by)} · ${formatDateTime(selected.handled_at)}`
                            : '아직 처리되지 않음'}
                        </div>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <th>연락처</th>
                    <td>
                      <div className={styles.tableInlineRow}>
                        <span className={styles.tableInlineValue}>
                          <EditableInline
                            value={selected.phone}
                            onCommit={(next) => {
                              if (!next) {
                                toast({ title: '연락처는 필수입니다', variant: 'error' });
                                return;
                              }
                              updateInquiry(selected.id, { phone: next });
                            }}
                            displayValue={formatPhone(selected.phone)}
                            required
                            maxLength={30}
                            inputMode="tel"
                            ariaLabel="연락처"
                            viewClassName={styles.editablePhone}
                            inputClassName={styles.editablePhoneInput}
                          />
                        </span>
                        <div className={styles.tableInlineActions}>
                          <a
                            href={`tel:${selected.phone}`}
                            className={styles.subtleIconBtn}
                            title="전화 걸기"
                            aria-label="전화 걸기"
                          >
                            <LuPhone size={14} />
                          </a>
                          <a
                            href={`sms:${selected.phone}`}
                            className={styles.subtleIconBtn}
                            title="문자 보내기"
                            aria-label="문자 보내기"
                          >
                            <LuMessageSquare size={14} />
                          </a>
                          <button
                            type="button"
                            className={styles.subtleIconBtn}
                            onClick={() => copyToClipboard(selected.phone, 'phone', '연락처')}
                            title={copiedKey === 'phone' ? '복사됨' : '번호 복사'}
                            aria-label={copiedKey === 'phone' ? '복사됨' : '번호 복사'}
                          >
                            {copiedKey === 'phone' ? <LuCheck size={14} /> : <LuCopy size={14} />}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <th>문의 내용</th>
                    <td>
                      <div className={styles.tableCellPad}>
                        <div className={styles.messageBox}>
                          {selected.message?.trim() ? (
                            <>
                              {selected.message}
                              <button
                                type="button"
                                className={styles.subtleLink}
                                onClick={() => copyToClipboard(selected.message ?? '', 'message', '문의 내용')}
                                title={copiedKey === 'message' ? '복사됨' : '내용 복사'}
                                aria-label={copiedKey === 'message' ? '복사됨' : '내용 복사'}
                              >
                                {copiedKey === 'message' ? <LuCheck size={12} /> : <LuCopy size={12} />}
                              </button>
                            </>
                          ) : (
                            <span className={styles.messageEmpty}>(내용 없음)</span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <th>업종</th>
                    <td>
                      <EditableInline
                        value={selected.industry}
                        onCommit={(next) =>
                          updateInquiry(selected.id, { industry: next === '' ? null : next })
                        }
                        emptyPlaceholder="-"
                        ariaLabel="업종"
                        maxLength={100}
                        viewClassName={styles.editableCell}
                        inputClassName={styles.editableCellInput}
                      />
                    </td>
                  </tr>

                  <tr>
                    <th>지역</th>
                    <td>
                      <EditableInline
                        value={selected.region}
                        onCommit={(next) =>
                          updateInquiry(selected.id, { region: next === '' ? null : next })
                        }
                        emptyPlaceholder="-"
                        ariaLabel="지역"
                        maxLength={100}
                        viewClassName={styles.editableCell}
                        inputClassName={styles.editableCellInput}
                      />
                    </td>
                  </tr>

                  <tr>
                    <th>관리자 메모</th>
                    <td>
                      <div className={styles.tableCellPad}>
                        <textarea
                          className={styles.noteEditor}
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value.slice(0, 2000))}
                          rows={10}
                          placeholder="처리 결과·통화 메모 등을 기록하세요"
                        />
                        <div className={styles.noteFooter}>
                          <span
                            className={`${styles.noteStatus} ${noteDirty ? styles.noteStatusDirty : ''}`}
                          >
                            {saving
                              ? '저장 중…'
                              : noteDirty
                              ? `저장되지 않은 변경사항 · ${noteDraft.length} / 2000`
                              : selected.admin_note
                              ? `최종 수정 ${relativeTime(selected.updated_at)} · ${noteDraft.length} / 2000`
                              : `메모 없음 · ${noteDraft.length} / 2000`}
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
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── Trace (collapsible) ── */}
            <button
              type="button"
              className={styles.traceToggle}
              onClick={() => setTraceOpen((o) => !o)}
              aria-expanded={traceOpen}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <LuLink size={12} /> 유입 정보
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
                    <span className={styles.metaLabel}>지역</span>
                    <span className={styles.metaValue}>
                      {selected.region || (
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
          </>
        )}
      </main>
    </div>
  );
}
