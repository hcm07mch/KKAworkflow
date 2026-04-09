'use client';

import { useEffect, useState, useCallback } from 'react';
import { LuBuilding2, LuUsers, LuShieldCheck, LuLoader, LuPlus, LuTrash2, LuPencil, LuX, LuCheck } from 'react-icons/lu';
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

const ROLE_BADGE: Record<UserRole, string> = { admin: 'badge-red', manager: 'badge-blue', member: 'badge-green' };

type SettingsSection = 'org' | 'members' | 'approval';
const SECTION_ICONS: Record<SettingsSection, React.ReactNode> = {
  org: <LuBuilding2 size={16} />,
  members: <LuUsers size={16} />,
  approval: <LuShieldCheck size={16} />,
};

const SECTIONS: { key: SettingsSection; label: string }[] = [
  { key: 'org', label: '조직 정보' },
  { key: 'members', label: '멤버 관리' },
  { key: 'approval', label: '승인 정책' },
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
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SettingsSection>('org');
  const [orgName, setOrgName] = useState('');

  // Policy editor state
  const [editingPolicy, setEditingPolicy] = useState<ApprovalPolicyItem | null>(null);
  const [isNewPolicy, setIsNewPolicy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings/org').then((r) => r.json()),
      fetch('/api/settings/members').then((r) => r.json()),
      fetch('/api/settings/approval-policies').then((r) => r.json()),
    ]).then(([orgData, membersData, policiesData]) => {
      setOrg(orgData);
      setOrgName(orgData.name ?? '');
      setMembers(membersData ?? []);
      setPolicies(Array.isArray(policiesData) ? policiesData : []);
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
                <ActionButton label="+ 멤버 초대" variant="primary" size="sm" onClick={() => alert('멤버 초대 (TODO)')} />
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
                      <td><ActionButton label="편집" variant="ghost" onClick={() => alert(`멤버 편집: ${m.name} (TODO)`)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

const DOC_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '기본 (전체 문서)' },
  { value: 'estimate', label: '견적서' },
  { value: 'contract', label: '계약서' },
  { value: 'pre_report', label: '사전 보고서' },
  { value: 'report', label: '결과 보고서' },
];

function emptyPolicy(): ApprovalPolicyItem {
  return {
    id: '',
    document_type: null,
    required_steps: 1,
    description: null,
    is_active: true,
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

  const handleNew = () => {
    setEditingPolicy(emptyPolicy());
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
      toast({ title: '정책이 삭제되었습니다', variant: 'success' });
    } else {
      toast({ title: '삭제에 실패했습니다', variant: 'error' });
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

  const docTypeLabel = (dt: string | null) => DOC_TYPE_OPTIONS.find((o) => o.value === (dt ?? ''))?.label ?? '기본';

  return (
    <>
      <div className={panel.detailHeader}>
        <div>
          <div className={panel.detailTitle}>승인 정책</div>
          <div className={panel.detailSubtitle}>문서 유형별 승인 규칙을 설정합니다</div>
        </div>
        <div className={panel.detailActions}>
          {!editingPolicy && (
            <ActionButton label="+ 정책 추가" variant="primary" size="sm" onClick={handleNew} />
          )}
        </div>
      </div>

      {/* 정책 편집 폼 */}
      {editingPolicy && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-primary)' }}>
            {isNewPolicy ? '새 정책 만들기' : '정책 수정'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>문서 유형</label>
              <select
                className="form-input"
                value={editingPolicy.document_type ?? ''}
                onChange={(e) => setEditingPolicy({ ...editingPolicy, document_type: (e.target.value || null) as DocumentType | null })}
              >
                {DOC_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>설명</label>
              <input
                type="text"
                className="form-input"
                placeholder="정책 설명 (선택)"
                value={editingPolicy.description ?? ''}
                onChange={(e) => setEditingPolicy({ ...editingPolicy, description: e.target.value || null })}
              />
            </div>
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
                value={step.label}
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
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 16 }}
          >
            <LuPlus size={12} /> 단계 추가
          </button>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <ActionButton label="취소" variant="ghost" size="sm" onClick={handleCancel} />
            <ActionButton label={saving ? '저장 중...' : '저장'} variant="primary" size="sm" onClick={handleSave} disabled={saving} />
          </div>
        </div>
      )}

      {/* 정책 목록 */}
      {policies.length === 0 && !editingPolicy && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
          승인 정책이 없습니다. 정책을 추가하면 문서 제출 시 자동 적용됩니다.
          <br />
          <span style={{ fontSize: 12 }}>정책이 없으면 기본값(1단계 매니저 승인)이 적용됩니다.</span>
        </div>
      )}

      {policies.map((p) => (
        <div key={p.id} className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {docTypeLabel(p.document_type)}
                {p.description && <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>{p.description}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`badge badge-sm ${p.is_active ? 'badge-green' : 'badge-slate'}`}>{p.is_active ? '활성' : '비활성'}</span>
              <button type="button" onClick={() => handleEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}>
                <LuPencil size={14} />
              </button>
              <button type="button" onClick={() => handleDelete(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}>
                <LuTrash2 size={14} />
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {p.steps
              .sort((a, b) => a.step - b.step)
              .map((s, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {i > 0 && <span style={{ color: 'var(--color-text-muted)' }}>→</span>}
                  <span className={`badge badge-sm ${ROLE_BADGE[s.required_role] ?? 'badge-slate'}`}>
                    {s.step}단계: {s.label || USER_ROLE_META[s.required_role]?.label || s.required_role}
                  </span>
                </span>
              ))}
          </div>
        </div>
      ))}
    </>
  );
}