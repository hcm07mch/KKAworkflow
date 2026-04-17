'use client';

import { useEffect, useState, useCallback } from 'react';
import { LuBuilding2, LuUsers, LuShieldCheck, LuLoader, LuPlus, LuTrash2, LuPencil, LuX, LuCheck, LuBookOpen, LuFileText, LuSearch } from 'react-icons/lu';
import { ActionButton, useFeedback } from '@/components/ui';
import type { ConfirmOptions } from '@/components/ui/confirm-dialog';
import type { ToastOptions } from '@/components/ui/toast';
import type { UserRole, DocumentType } from '@/lib/domain/types';
import { USER_ROLE_META, DOCUMENT_TYPE_META } from '@/lib/domain/types';
import panel from '../panel-layout.module.css';

// ── Types ────────────────────────────────────────────────

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  settings?: {
    default_estimate_notes?: string[];
    [key: string]: unknown;
  };
}

interface MemberItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

interface PolicyStep {
  step: number;
  required_role: UserRole;
  label: string;
  assigned_user_id: string | null;
}

interface ApprovalPolicyItem {
  id: string;
  document_type: DocumentType | null;
  required_steps: number;
  description: string | null;
  is_active: boolean;
  steps: PolicyStep[];
}

interface CatalogItem {
  id: string;
  catalog_type: 'estimate' | 'execution';
  group_name: string;
  name: string;
  sort_order: number;
  base_price: number;
  content: Record<string, unknown>;
  is_active: boolean;
}

interface CatalogLink {
  id: string;
  estimate_catalog_id: string;
  execution_catalog_id: string;
  estimate_catalog?: CatalogItem;
  execution_catalog?: CatalogItem;
}

const ROLE_BADGE: Record<UserRole, string> = { admin: 'badge-red', manager: 'badge-blue', member: 'badge-green' };

type SettingsSection = 'org' | 'members' | 'approval' | 'doc-defaults' | 'estimate-catalog' | 'execution-catalog';
const SECTION_ICONS: Record<SettingsSection, React.ReactNode> = {
  org: <LuBuilding2 size={16} />,
  members: <LuUsers size={16} />,
  approval: <LuShieldCheck size={16} />,
  'doc-defaults': <LuFileText size={16} />,
  'estimate-catalog': <LuBookOpen size={16} />,
  'execution-catalog': <LuBookOpen size={16} />,
};

const SECTIONS: { key: SettingsSection; label: string }[] = [
  { key: 'org', label: '조직 정보' },
  { key: 'members', label: '멤버 관리' },
  { key: 'approval', label: '승인 정책' },
  { key: 'doc-defaults', label: '문서 기본값' },
  { key: 'estimate-catalog', label: '견적서 카탈로그' },
  { key: 'execution-catalog', label: '집행 카탈로그' },
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Page ─────────────────────────────────────────────────

export default function SettingsPage() {
  const { toast, confirm } = useFeedback();
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [policies, setPolicies] = useState<ApprovalPolicyItem[]>([]);
  const [estimateCatalogs, setEstimateCatalogs] = useState<CatalogItem[]>([]);
  const [executionCatalogs, setExecutionCatalogs] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SettingsSection>('org');
  const [orgName, setOrgName] = useState('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Policy editor state
  const [editingPolicy, setEditingPolicy] = useState<ApprovalPolicyItem | null>(null);
  const [isNewPolicy, setIsNewPolicy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings/org').then((r) => r.json()),
      fetch('/api/settings/members').then((r) => r.json()),
      fetch('/api/settings/approval-policies').then((r) => r.json()),
      fetch('/api/settings/catalogs?type=estimate').then((r) => r.json()),
      fetch('/api/settings/catalogs?type=execution').then((r) => r.json()),
    ]).then(([orgData, membersData, policiesData, estCatalogs, execCatalogs]) => {
      setOrg(orgData);
      setOrgName(orgData.name ?? '');
      setMembers(membersData ?? []);
      setPolicies(Array.isArray(policiesData) ? policiesData : []);
      setEstimateCatalogs(Array.isArray(estCatalogs) ? estCatalogs : []);
      setExecutionCatalogs(Array.isArray(execCatalogs) ? execCatalogs : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={panel.wrapper}>
        <div className={panel.leftPanel}>
          <div className={panel.leftHeader}>
            <span className={panel.leftTitle}>설정</span>
          </div>
          <div className={panel.itemList}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={panel.skeletonItem}>
                <div className={panel.skeletonBar} style={{ width: '50%' }} />
              </div>
            ))}
          </div>
        </div>
        <div className={panel.rightPanel} />
      </div>
    );
  }

  return (
    <div className={panel.wrapper}>
      {/* ── Left Panel ── */}
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <span className={panel.leftTitle}>설정</span>
        </div>
        <div className={panel.itemList}>
          {SECTIONS.map((s) => (
            <div
              key={s.key}
              className={`${panel.item} ${activeSection === s.key ? panel.itemActive : ''}`}
              onClick={() => setActiveSection(s.key)}
            >
              <span className={panel.itemName} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{SECTION_ICONS[s.key]} {s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className={panel.rightPanel}>
        {/* 조직 정보 */}
        {activeSection === 'org' && org && (
          <>
            <div className={panel.detailHeader}>
              <div className={panel.detailTitle}>조직 정보</div>
            </div>
            <div className="card">
              <div className={panel.detailGrid} style={{ maxWidth: 480 }}>
                <div className={`${panel.detailField} ${panel.detailFieldFull}`}>
                  <span className={panel.fieldLabel}>조직명</span>
                  <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="form-input" />
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>슬러그</span>
                  <span className={panel.fieldValue}>{org.slug}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>생성일</span>
                  <span className={panel.fieldValue}>{formatDate(org.created_at)}</span>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <ActionButton label="저장" variant="primary" size="md" onClick={() => alert('조직 정보 저장 (TODO)')} />
              </div>
            </div>
          </>
        )}

        {/* 멤버 관리 */}
        {activeSection === 'members' && (
          <>
            <div className={panel.detailHeader}>
              <div>
                <div className={panel.detailTitle}>멤버 관리</div>
                <div className={panel.detailSubtitle}>총 {members.length}명</div>
              </div>
              <div className={panel.detailActions}>
                <ActionButton label="+ 멤버 초대" variant="primary" size="sm" onClick={() => setInviteModalOpen(true)} />
              </div>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr><th>이름</th><th>이메일</th><th>역할</th><th>상태</th><th>가입일</th><th></th></tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{m.name}</td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{m.email}</td>
                      <td><span className={`badge badge-sm ${ROLE_BADGE[m.role]}`}>{USER_ROLE_META[m.role]?.label ?? m.role}</span></td>
                      <td><span className={`badge badge-sm ${m.is_active ? 'badge-green' : 'badge-slate'}`}>{m.is_active ? '활성' : '비활성'}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{formatDate(m.created_at)}</td>
                      <td><ActionButton label="삭제" variant="danger" size="sm" onClick={async () => {
                        const ok = await confirm({ title: `"${m.name}" 멤버를 삭제하시겠습니까?`, description: '삭제된 멤버는 더 이상 시스템에 접근할 수 없습니다.', variant: 'danger' });
                        if (!ok) return;
                        try {
                          const res = await fetch(`/api/settings/members/${m.id}`, { method: 'DELETE' });
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            toast({ title: err?.error?.message || '삭제에 실패했습니다.', variant: 'error' });
                            return;
                          }
                          setMembers((prev) => prev.filter((x) => x.id !== m.id));
                          toast({ title: `${m.name} 멤버가 삭제되었습니다.`, variant: 'success' });
                        } catch {
                          toast({ title: '삭제에 실패했습니다.', variant: 'error' });
                        }
                      }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 멤버 초대 모달 */}
            {inviteModalOpen && (
              <InviteMemberModal
                onClose={() => setInviteModalOpen(false)}
                onInvited={(newMember) => {
                  setMembers((prev) => [...prev, newMember]);
                  setInviteModalOpen(false);
                }}
                toast={toast}
              />
            )}
          </>
        )}

        {/* 승인 정책 */}
        {activeSection === 'approval' && (
          <ApprovalPolicySection
            policies={policies}
            setPolicies={setPolicies}
            members={members}
            editingPolicy={editingPolicy}
            setEditingPolicy={setEditingPolicy}
            isNewPolicy={isNewPolicy}
            setIsNewPolicy={setIsNewPolicy}
            toast={toast}
            confirm={confirm}
          />
        )}

        {/* 견적서 카탈로그 */}
        {activeSection === 'estimate-catalog' && (
          <CatalogSection
            catalogType="estimate"
            title="견적서 카탈로그"
            subtitle="견적서 에디터에서 사용할 서비스 항목을 관리합니다"
            items={estimateCatalogs}
            setItems={setEstimateCatalogs}
            toast={toast}
            confirm={confirm}
          />
        )}

        {/* 집행 카탈로그 */}
        {activeSection === 'execution-catalog' && (
          <CatalogSection
            catalogType="execution"
            title="집행 카탈로그"
            subtitle="집행 보고서 에디터에서 사용할 서비스 항목을 관리합니다"
            items={executionCatalogs}
            setItems={setExecutionCatalogs}
            toast={toast}
            confirm={confirm}
          />
        )}

        {/* 문서 기본값 */}
        {activeSection === 'doc-defaults' && org && (
          <DefaultNotesSection org={org} setOrg={setOrg} toast={toast} />
        )}
      </div>
    </div>
  );
}

// ── Approval Policy Section ─────────────────────────────

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'member', label: '담당자' },
  { value: 'manager', label: '매니저' },
  { value: 'admin', label: '관리자' },
];

/** 문서 유형 그룹 (표시 순서) */
const DOC_TYPE_GROUPS: { value: DocumentType | null; label: string; description: string }[] = [
  { value: 'estimate',   label: '견적서',     description: '견적서 제출 시 적용되는 승인 정책' },
  { value: 'contract',   label: '계약서',     description: '계약서 제출 시 적용되는 승인 정책' },
  { value: 'pre_report', label: '사전 보고서', description: '사전 보고서 제출 시 적용되는 승인 정책' },
  { value: null,          label: '기본 정책',  description: '전용 정책이 없는 문서에 적용되는 기본 정책' },
];

function emptyPolicy(docType: DocumentType | null): ApprovalPolicyItem {
  return {
    id: '',
    document_type: docType,
    required_steps: 1,
    description: null,
    is_active: false,
    steps: [{ step: 1, required_role: 'manager', label: '매니저 승인', assigned_user_id: null }],
  };
}

function ApprovalPolicySection({
  policies, setPolicies, members, editingPolicy, setEditingPolicy, isNewPolicy, setIsNewPolicy, toast, confirm,
}: {
  policies: ApprovalPolicyItem[];
  setPolicies: React.Dispatch<React.SetStateAction<ApprovalPolicyItem[]>>;
  members: MemberItem[];
  editingPolicy: ApprovalPolicyItem | null;
  setEditingPolicy: (p: ApprovalPolicyItem | null) => void;
  isNewPolicy: boolean;
  setIsNewPolicy: (v: boolean) => void;
  toast: (opts: ToastOptions) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const handleNew = (docType: DocumentType | null) => {
    setEditingPolicy(emptyPolicy(docType));
    setIsNewPolicy(true);
  };

  const handleEdit = (p: ApprovalPolicyItem) => {
    setEditingPolicy({ ...p, steps: p.steps.map((s) => ({ ...s })) });
    setIsNewPolicy(false);
  };

  const handleCancel = () => {
    setEditingPolicy(null);
    setIsNewPolicy(false);
  };

  const handleDelete = async (p: ApprovalPolicyItem) => {
    const ok = await confirm({
      title: '정책을 삭제하시겠습니까?',
      description: '삭제된 정책은 복구할 수 없습니다.',
      variant: 'danger',
      confirmLabel: '삭제',
      cancelLabel: '취소',
    });
    if (!ok) return;
    const res = await fetch(`/api/settings/approval-policies/${p.id}`, { method: 'DELETE' });
    if (res.ok) {
      setPolicies((prev) => prev.filter((x) => x.id !== p.id));
      if (editingPolicy?.id === p.id) { setEditingPolicy(null); setIsNewPolicy(false); }
      toast({ title: '정책이 삭제되었습니다', variant: 'success' });
    } else {
      toast({ title: '삭제에 실패했습니다', variant: 'error' });
    }
  };

  /** 해당 문서 유형에서 특정 정책을 활성화하고 나머지를 비활성화 */
  const handleActivate = async (targetPolicy: ApprovalPolicyItem) => {
    if (activatingId) return;
    setActivatingId(targetPolicy.id);
    try {
    const docType = targetPolicy.document_type;
    const siblings = policies.filter((p) => p.document_type === docType && p.id !== targetPolicy.id && p.is_active);

    // 같은 문서유형의 다른 활성 정책 비활성화
    for (const sib of siblings) {
      await fetch(`/api/settings/approval-policies/${sib.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sib, is_active: false, steps: sib.steps }),
      });
    }
    // 선택된 정책 활성화
    const res = await fetch(`/api/settings/approval-policies/${targetPolicy.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...targetPolicy, is_active: true, steps: targetPolicy.steps }),
    });

    if (res.ok) {
      setPolicies((prev) => prev.map((p) => {
        if (p.document_type === docType && p.id !== targetPolicy.id) return { ...p, is_active: false };
        if (p.id === targetPolicy.id) return { ...p, is_active: true };
        return p;
      }));
      toast({ title: '승인 정책이 변경되었습니다', variant: 'success' });
    } else {
      toast({ title: '정책 변경에 실패했습니다', variant: 'error' });
    }
    } finally {
      setActivatingId(null);
    }
  };

  const handleSave = async () => {
    if (!editingPolicy) return;
    if (editingPolicy.steps.length === 0) {
      toast({ title: '최소 1단계를 추가하세요', variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        document_type: editingPolicy.document_type || null,
        required_steps: editingPolicy.steps.length,
        description: editingPolicy.description,
        is_active: editingPolicy.is_active,
        steps: editingPolicy.steps.map((s, i) => ({
          step: i + 1,
          required_role: s.required_role,
          label: s.label || null,
          assigned_user_id: s.assigned_user_id || null,
        })),
      };

      if (isNewPolicy) {
        const res = await fetch('/api/settings/approval-policies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          setPolicies((prev) => [...prev, created]);
          toast({ title: '정책이 생성되었습니다', variant: 'success' });
          setEditingPolicy(null);
          setIsNewPolicy(false);
        } else {
          const err = await res.json().catch(() => ({}));
          toast({ title: err?.error?.message || '생성에 실패했습니다', variant: 'error' });
        }
      } else {
        const res = await fetch(`/api/settings/approval-policies/${editingPolicy.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          setPolicies((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
          toast({ title: '정책이 수정되었습니다', variant: 'success' });
          setEditingPolicy(null);
        } else {
          toast({ title: '수정에 실패했습니다', variant: 'error' });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  // Step CRUD helpers
  const addStep = () => {
    if (!editingPolicy) return;
    const nextStep = editingPolicy.steps.length + 1;
    setEditingPolicy({
      ...editingPolicy,
      steps: [...editingPolicy.steps, { step: nextStep, required_role: 'admin', label: '', assigned_user_id: null }],
    });
  };

  const removeStep = (idx: number) => {
    if (!editingPolicy || editingPolicy.steps.length <= 1) return;
    setEditingPolicy({
      ...editingPolicy,
      steps: editingPolicy.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 })),
    });
  };

  const updateStep = (idx: number, field: keyof PolicyStep, value: string) => {
    if (!editingPolicy) return;
    setEditingPolicy({
      ...editingPolicy,
      steps: editingPolicy.steps.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    });
  };

  return (
    <>
      <div className={panel.detailHeader}>
        <div>
          <div className={panel.detailTitle}>승인 정책</div>
          <div className={panel.detailSubtitle}>문서 유형별 승인 규칙을 설정합니다</div>
        </div>
      </div>

      {/* 정책 편집 모달 */}
      {editingPolicy && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
        >
          <div
            style={{ width: 520, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', boxShadow: '0 16px 48px rgba(0,0,0,0.18)', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {isNewPolicy ? '새 정책 만들기' : `정책 수정: ${editingPolicy.description || ''}`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {DOC_TYPE_GROUPS.find((g) => g.value === editingPolicy.document_type)?.label ?? '기본 정책'}
                </div>
              </div>
              <button type="button" onClick={handleCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}>
                <LuX size={18} />
              </button>
            </div>

            {/* 모달 본문 */}
            <div style={{ padding: '16px 20px' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>설명</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="정책 설명 (예: 2단계 승인)"
                  value={editingPolicy.description ?? ''}
                  onChange={(e) => setEditingPolicy({ ...editingPolicy, description: e.target.value || null })}
                />
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>
                승인 단계 ({editingPolicy.steps.length}단계)
              </div>

              {editingPolicy.steps.map((step, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', minWidth: 32 }}>{idx + 1}단계</span>
                  <select
                    className="form-input"
                    value={step.required_role}
                    onChange={(e) => updateStep(idx, 'required_role', e.target.value)}
                    style={{ flex: 1 }}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="라벨 (예: 매니저 승인)"
                    value={step.label ?? ''}
                    onChange={(e) => updateStep(idx, 'label', e.target.value)}
                    style={{ flex: 2 }}
                  />
                  <select
                    className="form-input"
                    value={step.assigned_user_id ?? ''}
                    onChange={(e) => updateStep(idx, 'assigned_user_id', e.target.value)}
                    style={{ flex: 1.5 }}
                  >
                    <option value="">지정 담당자 없음</option>
                    {members.filter((m) => m.is_active).map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({USER_ROLE_META[m.role]?.label})</option>
                    ))}
                  </select>
                  {editingPolicy.steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(idx)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}
                    >
                      <LuTrash2 size={14} />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addStep}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
              >
                <LuPlus size={12} /> 단계 추가
              </button>
            </div>

            {/* 모달 푸터 */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid var(--color-border)' }}>
              <ActionButton label="취소" variant="ghost" size="sm" onClick={handleCancel} />
              <ActionButton label={saving ? '저장 중...' : '저장'} variant="primary" size="sm" onClick={handleSave} disabled={saving} />
            </div>
          </div>
        </div>
      )}

      {/* 문서 유형별 그룹 */}
      {DOC_TYPE_GROUPS.map((group) => {
        const groupPolicies = policies.filter((p) => p.document_type === group.value);
        const activePolicy = groupPolicies.find((p) => p.is_active);
        const isEditingInGroup = editingPolicy && editingPolicy.document_type === group.value;

        return (
          <div key={group.value ?? '__default'} className="card" style={{ marginBottom: 12 }}>
            {/* 그룹 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: groupPolicies.length > 0 ? 12 : 0 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {group.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {group.description}
                </div>
              </div>
              {!editingPolicy && (
                <button
                  type="button"
                  onClick={() => handleNew(group.value)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
                >
                  <LuPlus size={12} /> 추가
                </button>
              )}
            </div>

            {/* 정책 목록 (라디오 선택) */}
            {groupPolicies.length === 0 && !isEditingInGroup && (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '8px 0 0', borderTop: '1px solid var(--color-border)' }}>
                설정된 정책이 없습니다. {group.value === null ? '기본값(1단계 매니저 승인)이 적용됩니다.' : '기본 정책이 적용됩니다.'}
              </div>
            )}

            {groupPolicies.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 0',
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                {/* 라디오 선택 */}
                <input
                  type="radio"
                  name={`policy-${group.value ?? 'default'}`}
                  checked={p.is_active}
                  onChange={() => handleActivate(p)}
                  disabled={!!activatingId}
                  style={{ marginTop: 3, accentColor: 'var(--color-primary)', cursor: activatingId ? 'wait' : 'pointer' }}
                />
                {activatingId === p.id && (
                  <LuLoader size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: p.is_active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                      {p.description || `${p.steps.length}단계 승인`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {p.steps
                      .sort((a, b) => a.step - b.step)
                      .map((s, i) => (
                        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {i > 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>→</span>}
                          <span className={`badge badge-sm ${ROLE_BADGE[s.required_role] ?? 'badge-slate'}`} style={{ fontSize: 10 }}>
                            {s.label || USER_ROLE_META[s.required_role]?.label || s.required_role}
                          </span>
                        </span>
                      ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button type="button" onClick={() => handleEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}>
                    <LuPencil size={13} />
                  </button>
                  <button type="button" onClick={() => handleDelete(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}>
                    <LuTrash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

// ── Service Icon options (for execution catalog) ─────────

const EXECUTION_ICONS = [
  { id: 'shopping_reward', emoji: '🛒', label: '쇼핑 리워드' },
  { id: 'cafe_viral', emoji: '💬', label: '맘카페 바이럴' },
  { id: 'blog_viral', emoji: '📝', label: '블로그 바이럴' },
  { id: 'sns', emoji: '📱', label: 'SNS 운영' },
  { id: 'sa_ad', emoji: '🔍', label: 'SA 광고' },
  { id: 'meta_ad', emoji: '📣', label: 'Meta 광고' },
  { id: 'google_ad', emoji: '🌐', label: 'Google 광고' },
  { id: 'design', emoji: '🎨', label: '디자인' },
  { id: 'video', emoji: '🎬', label: '영상 제작' },
  { id: 'other', emoji: '📋', label: '기타' },
];

function fmtKRW(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n) + ' 원';
}

// ── Catalog Section (견적서 / 집행 카탈로그 편집) ─────────

function CatalogSection({
  catalogType, title, subtitle, items, setItems, toast, confirm,
}: {
  catalogType: 'estimate' | 'execution';
  title: string;
  subtitle: string;
  items: CatalogItem[];
  setItems: React.Dispatch<React.SetStateAction<CatalogItem[]>>;
  toast: (opts: ToastOptions) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  // content editing state
  const [details, setDetails] = useState<Array<{ title: string; descriptions: string[] }>>([]);
  const [note, setNote] = useState('');
  const [options, setOptions] = useState<Array<{ name: string; price: number }>>([]);
  const [icon, setIcon] = useState('other');
  const [fields, setFields] = useState<Array<{ label: string; value: string }>>([]);

  const loadContentState = (item: CatalogItem) => {
    const c = item.content as Record<string, unknown>;
    if (catalogType === 'estimate') {
      setDetails((c.details as Array<{ title: string; descriptions: string[] }>) ?? [{ title: '', descriptions: [''] }]);
      setNote((c.note as string) ?? '');
      setOptions((c.options as Array<{ name: string; price: number }>) ?? []);
    } else {
      setIcon((c.icon as string) ?? 'other');
      setFields((c.fields as Array<{ label: string; value: string }>) ?? [{ label: '', value: '' }]);
    }
  };

  const buildContent = (): Record<string, unknown> => {
    if (catalogType === 'estimate') {
      return { details, note, options: options.filter((o) => o.name) };
    }
    return { icon, fields: fields.filter((f) => f.label || f.value) };
  };

  const handleNew = () => {
    const item: CatalogItem = {
      id: '',
      catalog_type: catalogType,
      group_name: '',
      name: '',
      sort_order: items.length + 1,
      base_price: 0,
      content: {},
      is_active: true,
    };
    setEditing(item);
    setIsNew(true);
    loadContentState(item);
  };

  const handleEdit = (item: CatalogItem) => {
    setEditing({ ...item });
    setIsNew(false);
    loadContentState(item);
  };

  const handleCancel = () => {
    setEditing(null);
    setIsNew(false);
  };

  const handleDelete = async (item: CatalogItem) => {
    const ok = await confirm({
      title: '항목을 삭제하시겠습니까?',
      description: `"${item.name}" 을(를) 삭제합니다. 삭제 후 복구할 수 없습니다.`,
      variant: 'danger',
      confirmLabel: '삭제',
      cancelLabel: '취소',
    });
    if (!ok) return;
    const res = await fetch(`/api/settings/catalogs/${item.id}`, { method: 'DELETE' });
    if (res.ok) {
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      toast({ title: '항목이 삭제되었습니다', variant: 'success' });
    } else {
      toast({ title: '삭제에 실패했습니다', variant: 'error' });
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast({ title: '항목명을 입력하세요', variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        catalog_type: catalogType,
        group_name: editing.group_name,
        name: editing.name,
        sort_order: editing.sort_order,
        base_price: editing.base_price,
        content: buildContent(),
        is_active: editing.is_active,
      };

      if (isNew) {
        const res = await fetch('/api/settings/catalogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          setItems((prev) => [...prev, created]);
          toast({ title: '항목이 생성되었습니다', variant: 'success' });
          setEditing(null);
          setIsNew(false);
        } else {
          toast({ title: '생성에 실패했습니다', variant: 'error' });
        }
      } else {
        const res = await fetch(`/api/settings/catalogs/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
          toast({ title: '항목이 수정되었습니다', variant: 'success' });
          setEditing(null);
        } else {
          toast({ title: '수정에 실패했습니다', variant: 'error' });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      <div className={panel.detailHeader}>
        <div>
          <div className={panel.detailTitle}>{title}</div>
          <div className={panel.detailSubtitle}>{subtitle}</div>
        </div>
        <div className={panel.detailActions}>
          {!editing && (
            <ActionButton label="+ 항목 추가" variant="primary" size="sm" onClick={handleNew} />
          )}
        </div>
      </div>

      {/* 편집 폼 */}
      {editing && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-primary)' }}>
            {isNew ? '새 항목 추가' : '항목 수정'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>항목명</label>
              <input
                type="text"
                className="form-input"
                placeholder="예: 네이버 SA 광고"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>기본 단가 (원)</label>
              <input
                type="number"
                className="form-input"
                value={editing.base_price}
                onChange={(e) => setEditing({ ...editing, base_price: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>정렬 순서</label>
              <input
                type="number"
                className="form-input"
                value={editing.sort_order}
                onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* 견적서 카탈로그: details, note, options 편집 */}
          {catalogType === 'estimate' && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>
                상세 내용
              </div>
              {details.map((d, di) => (
                <div key={di} style={{ marginBottom: 12, padding: 12, border: '1px solid var(--color-border)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="제목"
                      value={d.title}
                      onChange={(e) => {
                        const next = [...details];
                        next[di] = { ...next[di], title: e.target.value };
                        setDetails(next);
                      }}
                      style={{ flex: 1 }}
                    />
                    {details.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDetails(details.filter((_, i) => i !== di))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}
                      >
                        <LuTrash2 size={14} />
                      </button>
                    )}
                  </div>
                  {d.descriptions.map((desc, dsi) => (
                    <div key={dsi} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, paddingLeft: 12 }}>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>·</span>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="설명"
                        value={desc}
                        onChange={(e) => {
                          const next = [...details];
                          const newDescs = [...next[di].descriptions];
                          newDescs[dsi] = e.target.value;
                          next[di] = { ...next[di], descriptions: newDescs };
                          setDetails(next);
                        }}
                        style={{ flex: 1, fontSize: 12 }}
                      />
                      {d.descriptions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...details];
                            next[di] = { ...next[di], descriptions: next[di].descriptions.filter((_, i) => i !== dsi) };
                            setDetails(next);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2 }}
                        >
                          <LuX size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...details];
                      next[di] = { ...next[di], descriptions: [...next[di].descriptions, ''] };
                      setDetails(next);
                    }}
                    style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 12px' }}
                  >
                    + 설명 추가
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setDetails([...details, { title: '', descriptions: [''] }])}
                style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <LuPlus size={12} /> 상세 항목 추가
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>비고</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="예: 월 정기결제"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>
                옵션 ({options.length}개)
              </div>
              {options.map((opt, oi) => (
                <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="옵션명"
                    value={opt.name}
                    onChange={(e) => {
                      const next = [...options];
                      next[oi] = { ...next[oi], name: e.target.value };
                      setOptions(next);
                    }}
                    style={{ flex: 2 }}
                  />
                  <input
                    type="number"
                    className="form-input"
                    placeholder="가격"
                    value={opt.price}
                    onChange={(e) => {
                      const next = [...options];
                      next[oi] = { ...next[oi], price: parseInt(e.target.value) || 0 };
                      setOptions(next);
                    }}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setOptions(options.filter((_, i) => i !== oi))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}
                  >
                    <LuTrash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setOptions([...options, { name: '', price: 0 }])}
                style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <LuPlus size={12} /> 옵션 추가
              </button>
            </>
          )}

          {/* 집행 카탈로그: icon, fields 편집 */}
          {catalogType === 'execution' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6, display: 'block' }}>아이콘</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {EXECUTION_ICONS.map((ic) => (
                      <button
                        key={ic.id}
                        type="button"
                        title={ic.label}
                        onClick={() => setIcon(ic.id)}
                        style={{
                          width: 36, height: 36,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18,
                          border: icon === ic.id ? '2px solid var(--color-primary, #3b82f6)' : '1px solid var(--color-border)',
                          borderRadius: 8,
                          background: icon === ic.id ? 'var(--color-primary-bg, #eff6ff)' : 'var(--color-bg, #fafafa)',
                          cursor: 'pointer',
                          transition: 'all 0.12s',
                        }}
                      >
                        {ic.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>
                필드 ({fields.length}개)
              </div>
              {fields.map((f, fi) => (
                <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="필드명 (예: 대상 상품)"
                    value={f.label}
                    onChange={(e) => {
                      const next = [...fields];
                      next[fi] = { ...next[fi], label: e.target.value };
                      setFields(next);
                    }}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="값 (예: 4개 상품)"
                    value={f.value}
                    onChange={(e) => {
                      const next = [...fields];
                      next[fi] = { ...next[fi], value: e.target.value };
                      setFields(next);
                    }}
                    style={{ flex: 1 }}
                  />
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setFields(fields.filter((_, i) => i !== fi))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}
                    >
                      <LuTrash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFields([...fields, { label: '', value: '' }])}
                style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <LuPlus size={12} /> 필드 추가
              </button>
            </>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <ActionButton label="취소" variant="ghost" size="sm" onClick={handleCancel} />
            <ActionButton label={saving ? '저장 중...' : '저장'} variant="primary" size="sm" onClick={handleSave} disabled={saving} />
          </div>
        </div>
      )}

      {/* 카탈로그 목록 */}
      {sortedItems.length === 0 && !editing && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
          카탈로그 항목이 없습니다. 항목을 추가하면 에디터에서 사용할 수 있습니다.
        </div>
      )}

      {sortedItems.map((item) => (
        <div key={item.id} className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {catalogType === 'execution' && (
                  <span style={{ marginRight: 6 }}>
                    {EXECUTION_ICONS.find((ic) => ic.id === (item.content as Record<string, unknown>)?.icon)?.emoji ?? '📋'}
                  </span>
                )}
                {item.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {fmtKRW(item.base_price)}
                {catalogType === 'estimate' && (item.content as Record<string, unknown>)?.note ? (
                  <span style={{ marginLeft: 8 }}>· {String((item.content as Record<string, unknown>).note)}</span>
                ) : null}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`badge badge-sm ${item.is_active ? 'badge-green' : 'badge-slate'}`}>{item.is_active ? '활성' : '비활성'}</span>
              <button type="button" onClick={() => handleEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}>
                <LuPencil size={14} />
              </button>
              <button type="button" onClick={() => handleDelete(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}>
                <LuTrash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// ── Invite Member Modal ─────────────────────────────────

interface InviteCandidate {
  authId: string;
  name: string;
  email: string;
  tierCode: string;
}

function InviteMemberModal({
  onClose, onInvited, toast,
}: {
  onClose: () => void;
  onInvited: (member: MemberItem) => void;
  toast: (opts: ToastOptions) => void;
}) {
  const [candidates, setCandidates] = useState<InviteCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('member');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetch('/api/settings/members/candidates')
      .then((r) => r.ok ? r.json() : [])
      .then((data: InviteCandidate[]) => { setCandidates(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = candidates.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  const handleInvite = async () => {
    if (!selectedId || inviting) return;
    setInviting(true);
    try {
      const res = await fetch('/api/settings/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authId: selectedId, role: selectedRole }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.error?.message || '초대에 실패했습니다', variant: 'error' });
        return;
      }
      const newMember = await res.json();
      toast({ title: `${newMember.name}님을 초대했습니다`, variant: 'success' });
      onInvited(newMember);
    } catch {
      toast({ title: '초대에 실패했습니다', variant: 'error' });
    } finally {
      setInviting(false);
    }
  };

  const TIER_LABEL: Record<string, string> = { admin: '관리자', manager: '매니저' };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
    >
      <div
        style={{ width: 520, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', boxShadow: '0 16px 48px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>멤버 초대</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>조직에 추가할 멤버를 선택하세요</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}>
            <LuX size={18} />
          </button>
        </div>

        {/* 검색 */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 10px' }}>
            <LuSearch size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 또는 이메일 검색..."
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--color-text-primary)' }}
            />
          </div>
        </div>

        {/* 후보 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 200, maxHeight: 360 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <LuLoader size={20} className="spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              {candidates.length === 0 ? '초대 가능한 멤버가 없습니다' : '검색 결과가 없습니다'}
            </div>
          ) : (
            filtered.map((c) => (
              <div
                key={c.authId}
                onClick={() => setSelectedId(c.authId === selectedId ? null : c.authId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 20px', cursor: 'pointer',
                  background: c.authId === selectedId ? 'var(--color-primary-bg, #eef2ff)' : 'transparent',
                  borderLeft: c.authId === selectedId ? '3px solid var(--color-primary, #6366f1)' : '3px solid transparent',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                  {c.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                </div>
                <span className="badge badge-sm badge-slate" style={{ flexShrink: 0 }}>{TIER_LABEL[c.tierCode] ?? c.tierCode}</span>
              </div>
            ))
          )}
        </div>

        {/* 하단 역할 선택 + 초대 버튼 */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', flexShrink: 0 }}>역할</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as UserRole)}
            className="form-input"
            style={{ width: 100, fontSize: 12 }}
          >
            <option value="member">담당자</option>
            <option value="manager">매니저</option>
            <option value="admin">관리자</option>
          </select>
          <div style={{ flex: 1 }} />
          <ActionButton label="취소" variant="ghost" size="sm" onClick={onClose} />
          <ActionButton
            label={inviting ? '초대 중...' : '초대'}
            variant="primary"
            size="sm"
            onClick={handleInvite}
            disabled={!selectedId || inviting}
          />
        </div>
      </div>
    </div>
  );
}

// ── Default Notes Section (문서 기본값) ─────────────────

const HARDCODED_DEFAULT_NOTES = [
  '본 견적서의 유효기간은 발행일로부터 14일입니다.',
  '상기 금액은 부가세(VAT) 별도 금액이며, 세금계산서 발행 가능합니다.',
  '광고 매체비(충전금)는 별도이며, 광고주가 직접 충전합니다.',
];

function DefaultNotesSection({
  org, setOrg, toast,
}: {
  org: OrgInfo;
  setOrg: React.Dispatch<React.SetStateAction<OrgInfo | null>>;
  toast: (opts: ToastOptions) => void;
}) {
  const [notes, setNotes] = useState<string[]>(
    () => org.settings?.default_estimate_notes?.length
      ? [...org.settings.default_estimate_notes]
      : [...HARDCODED_DEFAULT_NOTES],
  );
  const [saving, setSaving] = useState(false);

  const addNote = () => setNotes((prev) => [...prev, '']);
  const removeNote = (idx: number) => setNotes((prev) => prev.filter((_, i) => i !== idx));
  const updateNote = (idx: number, val: string) => setNotes((prev) => prev.map((n, i) => (i === idx ? val : n)));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { default_estimate_notes: notes.filter(Boolean) } }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setOrg(updated);
      toast({ title: '기본 참고사항이 저장되었습니다', variant: 'success' });
    } catch {
      toast({ title: '저장에 실패했습니다', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={panel.detailHeader}>
        <div>
          <div className={panel.detailTitle}>문서 기본값</div>
          <div className={panel.detailSubtitle}>새 견적서 작성 시 자동으로 채워지는 참고 사항을 설정합니다</div>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 640 }}>
        <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)' }}>
          견적서 참고 사항
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map((note, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ minWidth: 20, paddingTop: 7, fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'right' }}>{idx + 1}.</span>
              <textarea
                value={note}
                onChange={(e) => updateNote(idx, e.target.value)}
                className="form-input"
                rows={2}
                style={{ flex: 1, resize: 'vertical', fontSize: 13 }}
              />
              <button
                type="button"
                onClick={() => removeNote(idx)}
                style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                title="삭제"
              >
                <LuTrash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addNote}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', fontSize: 12, color: 'var(--color-primary)',
              background: 'none', border: '1px dashed var(--color-border)', borderRadius: 6, cursor: 'pointer',
            }}
          >
            <LuPlus size={12} /> 참고 사항 추가
          </button>
        </div>
        <div style={{ marginTop: 16 }}>
          <ActionButton label={saving ? '저장 중...' : '저장'} variant="primary" size="md" onClick={handleSave} disabled={saving} />
        </div>
      </div>
    </>
  );
}

// ── Catalog Link Section (견적↔집행 연결 관리) ───────────

function CatalogLinkSection({
  estimateCatalogs, executionCatalogs, links, setLinks, toast, confirm,
}: {
  estimateCatalogs: CatalogItem[];
  executionCatalogs: CatalogItem[];
  links: CatalogLink[];
  setLinks: React.Dispatch<React.SetStateAction<CatalogLink[]>>;
  toast: (opts: ToastOptions) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}) {
  const [newEstimateId, setNewEstimateId] = useState('');
  const [newExecutionId, setNewExecutionId] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newEstimateId || !newExecutionId) {
      toast({ title: '견적서 항목과 집행 항목을 모두 선택하세요', variant: 'warning' });
      return;
    }
    // Check duplicate
    if (links.some((l) => l.estimate_catalog_id === newEstimateId && l.execution_catalog_id === newExecutionId)) {
      toast({ title: '이미 연결된 항목입니다', variant: 'warning' });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/settings/catalogs/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate_catalog_id: newEstimateId, execution_catalog_id: newExecutionId }),
      });
      if (res.ok) {
        const created = await res.json();
        // Enrich with catalog data for display
        const enriched = {
          ...created,
          estimate_catalog: estimateCatalogs.find((c) => c.id === newEstimateId),
          execution_catalog: executionCatalogs.find((c) => c.id === newExecutionId),
        };
        setLinks((prev) => [...prev, enriched]);
        setNewEstimateId('');
        setNewExecutionId('');
        toast({ title: '연결이 추가되었습니다', variant: 'success' });
      } else {
        toast({ title: '연결 추가에 실패했습니다', variant: 'error' });
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (link: CatalogLink) => {
    const estName = link.estimate_catalog?.name ?? '견적 항목';
    const execName = link.execution_catalog?.name ?? '집행 항목';
    const ok = await confirm({
      title: '연결을 삭제하시겠습니까?',
      description: `"${estName}" ↔ "${execName}" 연결을 삭제합니다.`,
      variant: 'danger',
      confirmLabel: '삭제',
      cancelLabel: '취소',
    });
    if (!ok) return;
    const res = await fetch(`/api/settings/catalogs/links?id=${link.id}`, { method: 'DELETE' });
    if (res.ok) {
      setLinks((prev) => prev.filter((l) => l.id !== link.id));
      toast({ title: '연결이 삭제되었습니다', variant: 'success' });
    } else {
      toast({ title: '삭제에 실패했습니다', variant: 'error' });
    }
  };

  // Group links by estimate catalog
  const linksByEstimate = links.reduce<Record<string, CatalogLink[]>>((acc, link) => {
    const key = link.estimate_catalog_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(link);
    return acc;
  }, {});

  return (
    <>
      <div className={panel.detailHeader}>
        <div>
          <div className={panel.detailTitle}>카탈로그 연결</div>
          <div className={panel.detailSubtitle}>견적서 항목과 집행 항목을 연결합니다. 견적서에서 서비스를 추가하면 대응되는 집행 항목을 자동으로 제안합니다.</div>
        </div>
      </div>

      {/* 연결 추가 폼 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-primary)' }}>새 연결 추가</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>견적서 항목</label>
            <select className="form-input" value={newEstimateId} onChange={(e) => setNewEstimateId(e.target.value)}>
              <option value="">선택...</option>
              {estimateCatalogs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <span style={{ fontSize: 16, color: 'var(--color-text-muted)', paddingBottom: 8 }}>→</span>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>집행 항목</label>
            <select className="form-input" value={newExecutionId} onChange={(e) => setNewExecutionId(e.target.value)}>
              <option value="">선택...</option>
              {executionCatalogs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <ActionButton label={adding ? '추가 중...' : '연결'} variant="primary" size="sm" onClick={handleAdd} disabled={adding} />
        </div>
      </div>

      {/* 연결 목록 */}
      {links.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
          카탈로그 연결이 없습니다. 연결을 추가하면 견적서→집행 보고서 항목이 자동으로 제안됩니다.
        </div>
      )}

      {Object.entries(linksByEstimate).map(([estId, estLinks]) => {
        const estCatalog = estimateCatalogs.find((c) => c.id === estId);
        return (
          <div key={estId} className="card" style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
              📄 {estCatalog?.name ?? '알 수 없음'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 16 }}>
              {estLinks.map((link) => {
                const execCatalog = link.execution_catalog ?? executionCatalogs.find((c) => c.id === link.execution_catalog_id);
                const execIcon = EXECUTION_ICONS.find((ic) => ic.id === (execCatalog?.content as Record<string, unknown>)?.icon)?.emoji ?? '📋';
                return (
                  <div key={link.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      → {execIcon} {execCatalog?.name ?? '알 수 없음'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(link)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}
                    >
                      <LuTrash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}