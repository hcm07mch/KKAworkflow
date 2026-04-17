'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LuBuilding2, LuLoader, LuPlus } from 'react-icons/lu';
import { ActionButton } from '@/components/ui';
import {
  SERVICE_TYPE_META, PAYMENT_TYPE_META, CLIENT_TIER_META,
  PROJECT_STATUS_META,
  SERVICE_TYPES, PAYMENT_TYPES, CLIENT_TIERS,
} from '@/lib/domain/types';
import type { ServiceType, PaymentType, ClientTier, ProjectStatus } from '@/lib/domain/types';
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

interface ProjectItem {
  id: string;
  title: string;
  status: ProjectStatus;
  clientId: string;
  createdAt: string;
}

interface MemberItem {
  id: string;
  name: string;
  role: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Page ─────────────────────────────────────────────────

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClientItem | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [mode, setMode] = useState<'view' | 'new' | 'edit' | 'newProject'>('view');

  const selectClient = useCallback((c: ClientItem) => {
    setSelected(c);
    setMode('view');
    localStorage.setItem('clients_selectedId', c.id);
  }, []);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadClients = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/clients').then((r) => r.json()),
      fetch('/api/projects?limit=500').then((r) => r.json()),
      fetch('/api/settings/members').then((r) => r.json()),
    ]).then(([clientsData, projectsRes, membersData]) => {
      setMembers(membersData ?? []);
      const allProjects: ProjectItem[] = (projectsRes.data ?? []).map((p: any) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        clientId: p.client_id,
        createdAt: p.created_at,
      }));
      setProjects(allProjects);
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
      const savedId = localStorage.getItem('clients_selectedId');
      if (savedId) {
        const target = items.find((c) => c.id === savedId);
        if (target) { setSelected(target); setMode('view'); }
      }
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
    // 프로젝트 필드
    project_title: '',
    project_description: '',
    project_owner_id: '',
  };

  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const emptyProjectForm = {
    title: '',
    description: '',
    service_type: 'viral' as ServiceType,
    payment_type: 'deposit' as PaymentType,
    owner_id: '',
  };
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [projectFormError, setProjectFormError] = useState('');

  function updateProjectForm<K extends keyof typeof emptyProjectForm>(field: K, value: (typeof emptyProjectForm)[K]) {
    setProjectForm((prev) => ({ ...prev, [field]: value }));
  }

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

  function startNewProject() {
    if (!selected) return;
    setProjectForm({ ...emptyProjectForm, title: `${selected.name} 프로젝트` });
    setProjectFormError('');
    setMode('newProject');
  }

  async function handleProjectSubmit() {
    if (!selected) return;
    const trimmedTitle = projectForm.title.trim();
    if (!trimmedTitle) {
      setProjectFormError('프로젝트명은 필수입니다.');
      return;
    }
    setSaving(true);
    setProjectFormError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selected.id,
          title: trimmedTitle,
          description: projectForm.description.trim() || null,
          service_type: projectForm.service_type,
          payment_type: projectForm.payment_type,
          ...(projectForm.owner_id ? { owner_id: projectForm.owner_id } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || err.error || '프로젝트 생성에 실패했습니다.');
      }
      setMode('view');
      loadClients();
    } catch (e: any) {
      setProjectFormError(e.message || '프로젝트 생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    if (!selected) return;
    setForm({
      name: selected.name,
      contact_name: selected.contactName ?? '',
      contact_email: selected.contactEmail ?? '',
      contact_phone: selected.contactPhone ?? '',
      address: selected.address ?? '',
      notes: '',
      service_type: selected.serviceType,
      payment_type: selected.paymentType,
      tier: selected.tier,
      project_title: '',
      project_description: '',
      project_owner_id: '',
    });
    setFormError('');
    setMode('edit');
  }

  async function handleUpdate() {
    if (!selected) return;
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
      const res = await fetch(`/api/clients/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          contact_name: form.contact_name || null,
          contact_email: form.contact_email || null,
          contact_phone: form.contact_phone || null,
          address: form.address || null,
          tier: form.tier,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '수정에 실패했습니다.');
      }
      const updated = await res.json();
      const updatedClient: ClientItem = {
        id: updated.id,
        name: updated.name,
        contactName: updated.contact_name,
        contactEmail: updated.contact_email,
        contactPhone: updated.contact_phone,
        address: updated.address,
        serviceType: updated.service_type,
        paymentType: updated.payment_type,
        tier: updated.tier,
        projectCount: selected.projectCount,
        isActive: updated.is_active,
        createdAt: updated.created_at,
      };
      setSelected(updatedClient);
      setMode('view');
      loadClients();
    } catch (e: any) {
      setFormError(e.message || '수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`"${selected.name}" 고객사를 삭제하시겠습니까?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${selected.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '삭제에 실패했습니다.');
      }
      setSelected(null);
      setMode('view');
      loadClients();
    } catch (e: any) {
      alert(e.message || '삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
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
          project_title: form.project_title.trim() || null,
          project_description: form.project_description.trim() || null,
          project_owner_id: form.project_owner_id || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '등록에 실패했습니다.');
      }
      const created = await res.json();
      const newClient: ClientItem = {
        id: created.id,
        name: created.name,
        contactName: created.contact_name,
        contactEmail: created.contact_email,
        contactPhone: created.contact_phone,
        address: created.address,
        serviceType: created.service_type,
        paymentType: created.payment_type,
        tier: created.tier,
        projectCount: created.project ? 1 : 0,
        isActive: created.is_active,
        createdAt: created.created_at,
      };
      setSelected(newClient);
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
              className={`${panel.item} ${selected?.id === c.id && mode !== 'new' ? panel.itemActive : ''}`}
              onClick={() => selectClient(c)}
            >
              <span className={panel.itemName}>{c.name}</span>
              <span className={panel.itemMeta}>
                <span>{CLIENT_TIER_META[c.tier]?.label ?? '-'}</span>
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
        {mode === 'newProject' && selected ? (
          <>
            <div className={panel.detailHeader}>
              <div>
                <div className={panel.detailTitle}>새 프로젝트 생성</div>
                <div className={panel.detailSubtitle}>{selected.name}</div>
              </div>
              <div className={panel.detailActions}>
                <ActionButton label="취소" variant="ghost" size="sm" onClick={() => setMode('view')} />
                <ActionButton
                  label={saving ? '생성 중...' : '생성'}
                  variant="primary"
                  size="sm"
                  onClick={handleProjectSubmit}
                  disabled={saving}
                />
              </div>
            </div>

            {projectFormError && (
              <div style={{ padding: '10px 14px', marginBottom: 16, background: '#fee2e2', color: '#b91c1c', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                {projectFormError}
              </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className={panel.formTable}>
                <tbody>
                  <tr className={panel.requiredRow}>
                    <th>프로젝트명</th>
                    <td>
                      <input
                        type="text"
                        value={projectForm.title}
                        onChange={(e) => updateProjectForm('title', e.target.value)}
                        autoFocus
                      />
                    </td>
                  </tr>
                  <tr>
                    <th>서비스 유형</th>
                    <td>
                      <select
                        value={projectForm.service_type}
                        onChange={(e) => updateProjectForm('service_type', e.target.value as ServiceType)}
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
                        value={projectForm.payment_type}
                        onChange={(e) => updateProjectForm('payment_type', e.target.value as PaymentType)}
                      >
                        {PAYMENT_TYPES.map((t) => (
                          <option key={t} value={t}>{PAYMENT_TYPE_META[t].label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <th>담당자</th>
                    <td>
                      <select
                        value={projectForm.owner_id}
                        onChange={(e) => updateProjectForm('owner_id', e.target.value)}
                      >
                        <option value="">본인 (기본)</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <th>설명</th>
                    <td>
                      <textarea
                        value={projectForm.description}
                        onChange={(e) => updateProjectForm('description', e.target.value)}
                        rows={3}
                        style={{ resize: 'vertical' }}
                        placeholder="프로젝트에 대한 간단한 설명"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : mode === 'new' || mode === 'edit' ? (
          <>
            <div className={panel.detailHeader}>
              <div>
                <div className={panel.detailTitle}>{mode === 'new' ? '새 고객사 등록' : '고객사 정보 수정'}</div>
                <div className={panel.detailSubtitle}>{mode === 'new' ? '새로운 고객사 정보를 입력하세요.' : '고객사 정보를 수정하세요.'}</div>
              </div>
              <div className={panel.detailActions}>
                <ActionButton label="취소" variant="ghost" size="sm" onClick={() => { setMode('view'); setFormError(''); }} />
                {mode === 'edit' && (
                  <ActionButton
                    label={deleting ? '처리 중...' : '삭제'}
                    variant="danger"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting || saving}
                  />
                )}
                <ActionButton
                  label={saving ? '저장 중...' : mode === 'new' ? '등록' : '저장'}
                  variant="primary"
                  size="sm"
                  onClick={mode === 'new' ? handleSubmit : handleUpdate}
                  disabled={saving}
                />
              </div>
            </div>

            {formError && (
              <div style={{ padding: '10px 14px', marginBottom: 16, background: '#fee2e2', color: '#b91c1c', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                {formError}
              </div>
            )}

            <div className={panel.detailSectionTitle}>고객사 정보</div>
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

            {mode === 'new' && (
              <>
                <div className={panel.detailSectionTitle} style={{ marginTop: 24 }}>최초 생성 프로젝트 정보</div>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table className={panel.formTable}>
                    <tbody>
                      <tr>
                        <th>프로젝트명</th>
                        <td>
                          <input
                            type="text"
                            value={form.project_title}
                            onChange={(e) => updateForm('project_title', e.target.value)}
                            placeholder={form.name ? `${form.name} 프로젝트` : '고객사명 입력 시 자동 설정'}
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
                        <th>담당자</th>
                        <td>
                          <select
                            value={form.project_owner_id}
                            onChange={(e) => updateForm('project_owner_id', e.target.value)}
                          >
                            <option value="">본인 (기본)</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                      <tr>
                        <th>설명</th>
                        <td>
                          <textarea
                            value={form.project_description}
                            onChange={(e) => updateForm('project_description', e.target.value)}
                            rows={2}
                            style={{ resize: 'vertical' }}
                            placeholder="프로젝트에 대한 간단한 설명"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
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
                <ActionButton label="새 프로젝트" variant="primary" size="sm" onClick={startNewProject} />
                <ActionButton label="고객정보 수정" variant="secondary" size="sm" onClick={startEdit} />
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className={panel.formTable}>
                <tbody>
                  <tr>
                    <th>담당자</th>
                    <td><span className={panel.fieldValue}>{selected.contactName ?? '-'}</span></td>
                  </tr>
                  <tr>
                    <th>이메일</th>
                    <td><span className={panel.fieldValue}>{selected.contactEmail ?? '-'}</span></td>
                  </tr>
                  <tr>
                    <th>연락처</th>
                    <td><span className={panel.fieldValue}>{selected.contactPhone ?? '-'}</span></td>
                  </tr>
                  <tr>
                    <th>고객 등급</th>
                    <td><span className={panel.fieldValue}>{CLIENT_TIER_META[selected.tier]?.label ?? '-'}</span></td>
                  </tr>
                  <tr>
                    <th>주소</th>
                    <td><span className={panel.fieldValue}>{selected.address ?? '-'}</span></td>
                  </tr>
                  <tr>
                    <th>프로젝트 수</th>
                    <td><span className={panel.fieldValue}>{selected.projectCount}건</span></td>
                  </tr>
                  <tr>
                    <th>등록일</th>
                    <td><span className={panel.fieldValue}>{formatDate(selected.createdAt)}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={panel.detailSection}>
              <div className={panel.detailSectionTitle}>프로젝트 이력</div>
              {(() => {
                const clientProjects = projects.filter((p) => p.clientId === selected.id);
                if (clientProjects.length === 0) {
                  return (
                    <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                      등록된 프로젝트가 없습니다.
                    </div>
                  );
                }
                return (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className={panel.formTable}>
                      <tbody>
                        {clientProjects.map((p) => {
                          const meta = PROJECT_STATUS_META[p.status];
                          return (
                            <tr
                              key={p.id}
                              className={panel.clickableRow}
                              onClick={() => router.push(`/projects?selected=${p.id}`)}
                            >
                              <th>{meta?.shortLabel ?? p.status}</th>
                              <td>
                                <span className={panel.fieldValue}>
                                  {p.title}
                                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-muted)' }}>
                                    {formatDate(p.createdAt)}
                                  </span>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
