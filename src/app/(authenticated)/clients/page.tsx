'use client';

import { useEffect, useState, useCallback } from 'react';
import { LuBuilding2, LuLoader, LuPlus } from 'react-icons/lu';
import { ActionButton } from '@/components/ui';
import {
  SERVICE_TYPE_META, PAYMENT_TYPE_META, CLIENT_TIER_META,
  SERVICE_TYPES, PAYMENT_TYPES, CLIENT_TIERS,
} from '@/lib/domain/types';
import type { ServiceType, PaymentType, ClientTier } from '@/lib/domain/types';
import panel from '../panel-layout.module.css';

// ── Types ────────────────────────────────────────────────

interface ClientItem {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  serviceType: ServiceType;
  paymentType: PaymentType;
  tier: ClientTier;
  projectCount: number;
  isActive: boolean;
  createdAt: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Page ─────────────────────────────────────────────────

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClientItem | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [mode, setMode] = useState<'view' | 'new'>('view');
  const [saving, setSaving] = useState(false);

  const loadClients = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/clients').then((r) => r.json()),
      fetch('/api/projects?limit=500').then((r) => r.json()),
    ]).then(([clientsData, projectsRes]) => {
      const projectCounts = new Map<string, number>();
      for (const p of projectsRes.data ?? []) {
        projectCounts.set(p.client_id, (projectCounts.get(p.client_id) ?? 0) + 1);
      }
      const items: ClientItem[] = (clientsData ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        contactName: c.contact_name,
        contactEmail: c.contact_email,
        contactPhone: c.contact_phone,
        address: c.address,
        serviceType: c.service_type,
        paymentType: c.payment_type,
        tier: c.tier,
        projectCount: projectCounts.get(c.id) ?? 0,
        isActive: c.is_active,
        createdAt: c.created_at,
      }));
      setClients(items);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  // ── New client form state ──

  const emptyForm = {
    name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    notes: '',
    service_type: 'viral' as ServiceType,
    payment_type: 'deposit' as PaymentType,
    tier: 'regular' as ClientTier,
  };

  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  function updateForm<K extends keyof typeof emptyForm>(field: K, value: (typeof emptyForm)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function startNew() {
    setMode('new');
    setSelected(null);
    setForm(emptyForm);
    setFormError('');
  }

  function cancelNew() {
    setMode('view');
    setFormError('');
  }

  async function handleSubmit() {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setFormError('고객사명은 필수입니다.');
      return;
    }
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
      setFormError('올바른 이메일 형식을 입력하세요.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          contact_name: form.contact_name || null,
          contact_email: form.contact_email || null,
          contact_phone: form.contact_phone || null,
          address: form.address || null,
          notes: form.notes || null,
          service_type: form.service_type,
          payment_type: form.payment_type,
          tier: form.tier,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '등록에 실패했습니다.');
      }
      setMode('view');
      loadClients();
    } catch (e: any) {
      setFormError(e.message || '등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const filtered = clients.filter((c) => {
    if (!showInactive && !c.isActive) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.contactName?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  if (loading) {
    return (
      <div className={panel.wrapper}>
        <div className={panel.leftPanel}>
          <div className={panel.leftHeader}>
            <span className={panel.leftTitle}>고객 관리</span>
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
            <span className={panel.emptyIcon}><LuBuilding2 size={32} /></span>
            <span>고객사를 선택하세요</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={panel.wrapper}>
      {/* ── Left Panel ── */}
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <span className={panel.leftTitle}>고객 관리</span>
          <input
            className={panel.searchInput}
            placeholder="고객사 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={panel.filterTabs}>
            <button
              type="button"
              className={`${panel.filterTab} ${!showInactive ? panel.filterTabActive : ''}`}
              onClick={() => setShowInactive(false)}
            >활성</button>
            <button
              type="button"
              className={`${panel.filterTab} ${showInactive ? panel.filterTabActive : ''}`}
              onClick={() => setShowInactive(true)}
            >전체</button>
          </div>
        </div>

        <div className={panel.itemList}>
          <div className={panel.addItem} onClick={startNew}>
            <LuPlus size={14} /> 새 고객사
          </div>
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`${panel.item} ${selected?.id === c.id && mode === 'view' ? panel.itemActive : ''}`}
              onClick={() => { setSelected(c); setMode('view'); }}
            >
              <span className={panel.itemName}>{c.name}</span>
              <span className={panel.itemMeta}>
                <span>{SERVICE_TYPE_META[c.serviceType]?.label ?? '-'}</span>
                <span>·</span>
                <span>{c.projectCount}건</span>
                {!c.isActive && <span className={`badge badge-sm badge-slate ${panel.itemBadge}`}>비활성</span>}
              </span>
            </div>
          ))}
        </div>

        <div className={panel.leftFooter}>{filtered.length}개 고객사</div>
      </div>

      {/* ── Right Panel ── */}
      <div className={panel.rightPanel}>
        {mode === 'new' ? (
          <>
            <div className={panel.detailHeader}>
              <div>
                <div className={panel.detailTitle}>새 고객사 등록</div>
                <div className={panel.detailSubtitle}>새로운 고객사 정보를 입력하세요.</div>
              </div>
              <div className={panel.detailActions}>
                <ActionButton label="취소" variant="ghost" size="sm" onClick={cancelNew} />
                <ActionButton label={saving ? '저장 중...' : '등록'} variant="primary" size="sm" onClick={handleSubmit} disabled={saving} />
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
                  <tr className={panel.requiredRow}>
                    <th>고객사명</th>
                    <td>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => updateForm('name', e.target.value)}
                        autoFocus
                      />
                    </td>
                  </tr>
                  <tr>
                    <th>담당자</th>
                    <td>
                      <input
                        type="text"
                        value={form.contact_name}
                        onChange={(e) => updateForm('contact_name', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <th>이메일</th>
                    <td>
                      <input
                        type="email"
                        value={form.contact_email}
                        onChange={(e) => updateForm('contact_email', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <th>연락처</th>
                    <td>
                      <input
                        type="tel"
                        value={form.contact_phone}
                        onChange={(e) => updateForm('contact_phone', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <th>서비스 유형</th>
                    <td>
                      <select
                        value={form.service_type}
                        onChange={(e) => updateForm('service_type', e.target.value as ServiceType)}
                      >
                        {SERVICE_TYPES.map((t) => (
                          <option key={t} value={t}>{SERVICE_TYPE_META[t].label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <th>결제 방식</th>
                    <td>
                      <select
                        value={form.payment_type}
                        onChange={(e) => updateForm('payment_type', e.target.value as PaymentType)}
                      >
                        {PAYMENT_TYPES.map((t) => (
                          <option key={t} value={t}>{PAYMENT_TYPE_META[t].label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <th>고객 등급</th>
                    <td>
                      <select
                        value={form.tier}
                        onChange={(e) => updateForm('tier', e.target.value as ClientTier)}
                      >
                        {CLIENT_TIERS.map((t) => (
                          <option key={t} value={t}>{CLIENT_TIER_META[t].label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <th>주소</th>
                    <td>
                      <input
                        type="text"
                        value={form.address}
                        onChange={(e) => updateForm('address', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <th>메모</th>
                    <td>
                      <textarea
                        value={form.notes}
                        onChange={(e) => updateForm('notes', e.target.value)}
                        rows={3}
                        style={{ resize: 'vertical' }}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : !selected ? (
          <div className={panel.emptyState}>
            <span className={panel.emptyIcon}><LuBuilding2 size={32} /></span>
            <span>고객사를 선택하세요</span>
          </div>
        ) : (
          <>
            <div className={panel.detailHeader}>
              <div>
                <div className={panel.detailTitle}>{selected.name}</div>
                <div className={panel.detailSubtitle}>
                  {CLIENT_TIER_META[selected.tier]?.label ?? '-'} · {selected.isActive ? '활성' : '비활성'}
                </div>
              </div>
              <div className={panel.detailActions}>
                <ActionButton label="수정" variant="secondary" size="sm" onClick={() => alert('수정 (TODO)')} />
                <ActionButton
                  label={selected.isActive ? '비활성화' : '활성화'}
                  variant={selected.isActive ? 'danger' : 'primary'}
                  size="sm"
                  onClick={() => alert('상태 변경(TODO)')}
                />
              </div>
            </div>

            <div className="card">
              <div className={panel.detailGrid}>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>담당자</span>
                  <span className={panel.fieldValue}>{selected.contactName ?? '-'}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>이메일</span>
                  <span className={panel.fieldValue}>{selected.contactEmail ?? '-'}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>연락처</span>
                  <span className={panel.fieldValue}>{selected.contactPhone ?? '-'}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>프로젝트 수</span>
                  <span className={panel.fieldValue}>{selected.projectCount}건</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>서비스 유형</span>
                  <span className={panel.fieldValue}>{SERVICE_TYPE_META[selected.serviceType]?.label ?? '-'}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>결제 방식</span>
                  <span className={panel.fieldValue}>{PAYMENT_TYPE_META[selected.paymentType]?.label ?? '-'}</span>
                </div>
                <div className={`${panel.detailField} ${panel.detailFieldFull}`}>
                  <span className={panel.fieldLabel}>주소</span>
                  <span className={panel.fieldValue}>{selected.address ?? '-'}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>등록일</span>
                  <span className={panel.fieldValue}>{formatDate(selected.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className={panel.detailSection}>
              <div className={panel.detailSectionTitle}>프로젝트 이력</div>
              <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                이 고객사의 프로젝트가 여기에 표시됩니다.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
