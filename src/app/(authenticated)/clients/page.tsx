'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LuBuilding2, LuLoader, LuPlus, LuUpload, LuFileText, LuX } from 'react-icons/lu';
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
  notes: string | null;
  organizationId: string | null;
  organizationName: string | null;
  serviceType: ServiceType;
  paymentType: PaymentType;
  tier: ClientTier;
  projectCount: number;
  isActive: boolean;
  createdAt: string;
  businessNumber: string | null;
  businessRegFilePath: string | null;
  businessRegFileName: string | null;
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
  const [orgInfo, setOrgInfo] = useState<{ id: string; name: string; parent_id: string | null } | null>(null);
  const [childOrgs, setChildOrgs] = useState<Array<{ id: string; name: string }>>([]);
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
  const [migrateModal, setMigrateModal] = useState<{ newOrgName: string; count: number } | null>(null);

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
        notes: c.notes ?? null,
        organizationId: c.organization_id ?? null,
        organizationName: c.organization?.name ?? null,
        serviceType: c.service_type,
        paymentType: c.payment_type,
        tier: c.tier,
        projectCount: projectCounts.get(c.id) ?? 0,
        isActive: c.is_active,
        createdAt: c.created_at,
        businessNumber: c.business_number ?? null,
        businessRegFilePath: c.business_registration_file_path ?? null,
        businessRegFileName: c.business_registration_file_name ?? null,
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

  // 본사(루트) 계정은 고객의 소속 조직을 변경 가능하도록 조직 정보 로드
  useEffect(() => {
    Promise.all([
      fetch('/api/settings/org').then((r) => r.ok ? r.json() : null),
      fetch('/api/settings/departments').then((r) => r.ok ? r.json() : []),
    ]).then(([org, depts]) => {
      if (org) setOrgInfo({ id: org.id, name: org.name, parent_id: org.parent_id ?? null });
      setChildOrgs((depts ?? []).map((d: any) => ({ id: d.id, name: d.name })));
    }).catch(() => {});
  }, []);

  const isRootOrg = !!orgInfo && !orgInfo.parent_id;
  const allowedOrgOptions = orgInfo
    ? [{ id: orgInfo.id, name: orgInfo.name }, ...childOrgs]
    : [];

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
    organization_id: '',
    business_number: '',
    // 프로젝트 필드
    project_title: '',
    project_description: '',
    project_owner_id: '',
  };

  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [businessRegFile, setBusinessRegFile] = useState<File | null>(null);

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
    setForm({ ...emptyForm, organization_id: orgInfo?.id ?? '' });
    setBusinessRegFile(null);
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
      notes: selected.notes ?? '',
      service_type: selected.serviceType,
      payment_type: selected.paymentType,
      tier: selected.tier,
      organization_id: selected.organizationId ?? '',
      business_number: selected.businessNumber ?? '',
      project_title: '',
      project_description: '',
      project_owner_id: '',
    });
    setBusinessRegFile(null);
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

    // 조직 변경 시 프로젝트 이관 여부 확인 — 커스텀 3-옵션 모달 사용
    const orgChanged = isRootOrg && !!form.organization_id && form.organization_id !== selected.organizationId;
    if (orgChanged) {
      const clientProjectCount = projects.filter((p) => p.clientId === selected.id).length;
      if (clientProjectCount > 0) {
        const newOrgName = allowedOrgOptions.find((o) => o.id === form.organization_id)?.name ?? '선택한 조직';
        setMigrateModal({ newOrgName, count: clientProjectCount });
        return; // 모달에서 선택 시 performClientUpdate 호출
      }
    }

    // 조직 미변경 또는 프로젝트 없음 → 바로 저장
    performClientUpdate(false, orgChanged);
  }

  async function performClientUpdate(migrateProjects: boolean, orgChanged: boolean) {
    if (!selected) return;
    const trimmedName = form.name.trim();
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
          notes: form.notes || null,
          tier: form.tier,
          business_number: form.business_number.trim() || null,
          ...(orgChanged ? { organization_id: form.organization_id, migrate_projects: migrateProjects } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || (typeof err.error === 'string' ? err.error : null) || '수정에 실패했습니다.');
      }
      const updated = await res.json();

      // 사업자 등록증 파일 업로드 (선택된 경우)
      if (businessRegFile) {
        const fd = new FormData();
        fd.append('file', businessRegFile);
        const up = await fetch(`/api/clients/${selected.id}/business-registration`, {
          method: 'POST',
          body: fd,
        });
        if (!up.ok) {
          const err = await up.json().catch(() => ({}));
          throw new Error(err.error?.message || '사업자 등록증 파일 업로드에 실패했습니다.');
        }
      }
      const newOrgName = updated.organization_id
        ? (allowedOrgOptions.find((o) => o.id === updated.organization_id)?.name ?? selected.organizationName)
        : selected.organizationName;
      const updatedClient: ClientItem = {
        id: updated.id,
        name: updated.name,
        contactName: updated.contact_name,
        contactEmail: updated.contact_email,
        contactPhone: updated.contact_phone,
        address: updated.address,
        notes: updated.notes ?? null,
        organizationId: updated.organization_id ?? null,
        organizationName: newOrgName,
        serviceType: updated.service_type,
        paymentType: updated.payment_type,
        tier: updated.tier,
        projectCount: selected.projectCount,
        isActive: updated.is_active,
        createdAt: updated.created_at,
        businessNumber: updated.business_number ?? null,
        businessRegFilePath: businessRegFile
          ? (businessRegFile.name ? 'pending' : selected.businessRegFilePath)
          : selected.businessRegFilePath,
        businessRegFileName: businessRegFile ? businessRegFile.name : selected.businessRegFileName,
      };
      setSelected(updatedClient);
      setMode('view');
      loadClients();
      if (orgChanged && migrateProjects) {
        const count = typeof updated.migrated_project_count === 'number' ? updated.migrated_project_count : null;
        if (count === 0) {
          alert('고객은 이관되었으나 이관된 프로젝트가 없습니다. (해당 고객에 연결된 프로젝트가 없거나 DB 권한 문제일 수 있습니다)');
        } else if (count != null) {
          alert(`고객과 프로젝트 ${count}건이 새 조직으로 이관되었습니다.`);
        }
      }
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
        throw new Error(err.error?.message || (typeof err.error === 'string' ? err.error : null) || '삭제에 실패했습니다.');
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
          business_number: form.business_number.trim() || null,
          ...(form.organization_id ? { organization_id: form.organization_id } : {}),
          project_title: form.project_title.trim() || null,
          project_description: form.project_description.trim() || null,
          project_owner_id: form.project_owner_id || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || (typeof err.error === 'string' ? err.error : null) || '등록에 실패했습니다.');
      }
      const created = await res.json();

      // 사업자 등록증 파일 업로드
      let uploadedFileName: string | null = null;
      if (businessRegFile) {
        const fd = new FormData();
        fd.append('file', businessRegFile);
        const up = await fetch(`/api/clients/${created.id}/business-registration`, {
          method: 'POST',
          body: fd,
        });
        if (!up.ok) {
          const err = await up.json().catch(() => ({}));
          throw new Error(err.error?.message || '사업자 등록증 파일 업로드에 실패했습니다.');
        }
        const uploaded = await up.json();
        uploadedFileName = uploaded.file_name ?? businessRegFile.name;
      }
      const newClient: ClientItem = {
        id: created.id,
        name: created.name,
        contactName: created.contact_name,
        contactEmail: created.contact_email,
        contactPhone: created.contact_phone,
        address: created.address,
        notes: created.notes ?? null,
        organizationId: created.organization_id ?? null,
        organizationName: created.organization?.name ?? null,
        serviceType: created.service_type,
        paymentType: created.payment_type,
        tier: created.tier,
        projectCount: created.project ? 1 : 0,
        isActive: created.is_active,
        createdAt: created.created_at,
        businessNumber: created.business_number ?? null,
        businessRegFilePath: uploadedFileName ? 'pending' : null,
        businessRegFileName: uploadedFileName,
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
                  {((mode === 'edit' && isRootOrg) || (mode === 'new' && isRootOrg)) && allowedOrgOptions.length > 1 && (
                    <tr>
                      <th>소속 조직</th>
                      <td>
                        <select
                          value={form.organization_id}
                          onChange={(e) => updateForm('organization_id', e.target.value)}
                        >
                          {mode === 'new' && <option value="">선택 안 함 (본사)</option>}
                          {allowedOrgOptions.map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )}
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
                    <th>사업자 번호</th>
                    <td>
                      <input
                        type="text"
                        value={form.business_number}
                        onChange={(e) => updateForm('business_number', e.target.value)}
                        placeholder="예: 123-45-67890"
                      />
                    </td>
                  </tr>
                  <tr>
                    <th>사업자 등록증</th>
                    <td>
                      {mode === 'edit' && selected?.businessRegFileName && !businessRegFile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13 }}>
                          <LuFileText size={14} />
                          <span>{selected.businessRegFileName}</span>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm('사업자 등록증 파일을 삭제하시겠습니까?')) return;
                              const res = await fetch(`/api/clients/${selected.id}/business-registration`, { method: 'DELETE' });
                              if (res.ok) loadClients();
                            }}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center' }}
                            title="파일 삭제"
                          >
                            <LuX size={14} />
                          </button>
                        </div>
                      )}
                      {businessRegFile ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                          <LuFileText size={14} />
                          <span>{businessRegFile.name}</span>
                          <button
                            type="button"
                            onClick={() => setBusinessRegFile(null)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center' }}
                            title="선택 해제"
                          >
                            <LuX size={14} />
                          </button>
                        </div>
                      ) : (
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--color-surface-alt, #f3f4f6)', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                          <LuUpload size={14} />
                          <span>{selected?.businessRegFileName ? '파일 변경' : '파일 선택'}</span>
                          <input
                            type="file"
                            accept="application/pdf,image/png,image/jpeg,image/webp"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) setBusinessRegFile(f);
                            }}
                            style={{ display: 'none' }}
                          />
                        </label>
                      )}
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--color-text-muted)' }}>
                        PDF, PNG, JPG, WEBP · 최대 20MB
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <th>고객측 담당자</th>
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
                    <th>소속 조직</th>
                    <td><span className={panel.fieldValue}>{selected.organizationName ?? '-'}</span></td>
                  </tr>
                  <tr>
                    <th>사업자 번호</th>
                    <td><span className={panel.fieldValue}>{selected.businessNumber ?? '-'}</span></td>
                  </tr>
                  <tr>
                    <th>사업자 등록증</th>
                    <td>
                      {selected.businessRegFileName ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await fetch(`/api/clients/${selected.id}/business-registration`);
                            if (!res.ok) {
                              alert('파일을 열 수 없습니다.');
                              return;
                            }
                            const { url } = await res.json();
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-primary, #2563eb)', padding: 0, fontSize: 13, textDecoration: 'underline' }}
                        >
                          <LuFileText size={14} />
                          {selected.businessRegFileName}
                        </button>
                      ) : (
                        <span className={panel.fieldValue}>-</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>고객측 담당자</th>
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
                  <tr>
                    <th>메모</th>
                    <td><span className={panel.fieldValue} style={{ whiteSpace: 'pre-wrap' }}>{selected.notes ?? '-'}</span></td>
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

      {/* ── 프로젝트 이관 선택 모달 ── */}
      {migrateModal && selected && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)',
          }}
          onClick={() => setMigrateModal(null)}
        >
          <div
            style={{
              width: 480, maxWidth: 'calc(100vw - 32px)',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)', boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '20px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#2563eb', flexShrink: 0,
                }}>
                  <LuBuilding2 size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                    고객 조직 이관
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--color-text-primary)' }}>"{selected.name}"</strong> 고객의 프로젝트{' '}
                    <strong style={{ color: 'var(--color-text-primary)' }}>{migrateModal.count}건</strong>을{' '}
                    <strong style={{ color: 'var(--color-text-primary)' }}>"{migrateModal.newOrgName}"</strong>(으)로 어떻게 처리할까요?
                  </p>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                className="btn btn-md btn-primary"
                style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px', height: 'auto' }}
                onClick={() => {
                  setMigrateModal(null);
                  performClientUpdate(true, true);
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>프로젝트 함께 이관</div>
                  <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2, fontWeight: 400 }}>
                    고객과 프로젝트 {migrateModal.count}건을 새 조직으로 모두 이동
                  </div>
                </div>
              </button>
              <button
                type="button"
                className="btn btn-md btn-secondary"
                style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px', height: 'auto' }}
                onClick={() => {
                  setMigrateModal(null);
                  performClientUpdate(false, true);
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>고객만 이관</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, fontWeight: 400 }}>
                    프로젝트는 현재 조직에 유지, 고객만 새 조직으로 이동
                  </div>
                </div>
              </button>
              <button
                type="button"
                className="btn btn-md btn-ghost"
                style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px', height: 'auto' }}
                onClick={() => setMigrateModal(null)}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>취소</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, fontWeight: 400 }}>
                    작업을 취소하고 이전 상태로 돌아가기
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
