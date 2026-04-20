'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { LuBuilding2, LuUsers, LuShieldCheck, LuLoader, LuPlus, LuTrash2, LuPencil, LuX, LuCheck, LuBookOpen, LuFileText, LuSearch, LuGripVertical, LuCopy } from 'react-icons/lu';
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
  parent_id: string | null;
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
  organization_id: string;
}

interface SubOrgItem {
  id: string;
  name: string;
  slug: string;
  parent_id: string;
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

interface CatalogCategory {
  id: string;
  catalog_type: 'estimate' | 'execution';
  name: string;
  sort_order: number;
}

interface CatalogItem {
  id: string;
  catalog_type: 'estimate' | 'execution';
  group_name: string;
  category_id: string | null;
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
  { key: 'org', label: '조직 관리' },
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
  const [departments, setDepartments] = useState<SubOrgItem[]>([]);
  const [policies, setPolicies] = useState<ApprovalPolicyItem[]>([]);
  const [estimateCatalogs, setEstimateCatalogs] = useState<CatalogItem[]>([]);
  const [executionCatalogs, setExecutionCatalogs] = useState<CatalogItem[]>([]);
  const [estimateCategories, setEstimateCategories] = useState<CatalogCategory[]>([]);
  const [executionCategories, setExecutionCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SettingsSection>('org');
  const [orgName, setOrgName] = useState('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Policy editor state
  const [editingPolicy, setEditingPolicy] = useState<ApprovalPolicyItem | null>(null);
  const [isNewPolicy, setIsNewPolicy] = useState(false);

  // Approval policy org selector (root 계정 전용)
  const [policyOrgs, setPolicyOrgs] = useState<{ id: string; name: string; parent_id: string | null }[]>([]);
  const [selectedPolicyOrgId, setSelectedPolicyOrgId] = useState<string | null>(null);
  const [policyMembers, setPolicyMembers] = useState<MemberItem[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);

  // 현재 스코프 정보 (본사 계정 전용) — 본사 업무 여부 판별용
  const [isRootAccount, setIsRootAccount] = useState(false);
  const [rootOrgId, setRootOrgId] = useState<string | null>(null);
  const [activeScope, setActiveScope] = useState<string | null>(null);
  // 본사 업무 = 스코프가 본사(루트)이거나 아직 미설정 (미설정이면 서버는 본사로 해석)
  const isHqScope = isRootAccount && (activeScope === null || activeScope === rootOrgId);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings/org').then((r) => r.json()),
      fetch('/api/settings/members?all=1').then((r) => r.json()),
      fetch('/api/settings/approval-policies').then((r) => r.json()),
      fetch('/api/settings/catalogs?type=estimate').then((r) => r.json()),
      fetch('/api/settings/catalogs?type=execution').then((r) => r.json()),
      fetch('/api/settings/departments').then((r) => r.json()),
      fetch('/api/settings/catalog-categories?type=estimate').then((r) => r.json()),
      fetch('/api/settings/catalog-categories?type=execution').then((r) => r.json()),
      fetch('/api/scope').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([orgData, membersData, policiesData, estCatalogs, execCatalogs, deptData, estCategories, execCategories, scopeData]) => {
      setOrg(orgData);
      setOrgName(orgData.name ?? '');
      // 지사 계정이면 기본 섹션을 '문서 기본값'으로 이동 (조직/멤버/승인은 비노출)
      if (orgData?.parent_id) {
        setActiveSection('doc-defaults');
      }
      setMembers(membersData ?? []);
      setPolicyMembers(membersData ?? []);
      setDepartments(Array.isArray(deptData) ? deptData : []);
      setPolicies(Array.isArray(policiesData) ? policiesData : []);
      setEstimateCatalogs(Array.isArray(estCatalogs) ? estCatalogs : []);
      setExecutionCatalogs(Array.isArray(execCatalogs) ? execCatalogs : []);
      setEstimateCategories(Array.isArray(estCategories) ? estCategories : []);
      setExecutionCategories(Array.isArray(execCategories) ? execCategories : []);

      // 본사 계정이면 승인 정책 조직 선택기 초기화 (기본값: 본사)
      if (scopeData?.isRootOrg && Array.isArray(scopeData?.orgs)) {
        setIsRootAccount(true);
        setActiveScope(scopeData.activeScope ?? null);
        setPolicyOrgs(scopeData.orgs);
        const rootOrg = scopeData.orgs.find((o: { parent_id: string | null }) => !o.parent_id);
        setRootOrgId(rootOrg?.id ?? null);
        setSelectedPolicyOrgId(rootOrg?.id ?? null);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // 선택된 정책 조직이 변경되면 해당 조직의 정책 / 멤버 재조회
  useEffect(() => {
    if (!selectedPolicyOrgId || !org || org.parent_id) return; // 지사 계정은 스킵
    setPoliciesLoading(true);
    Promise.all([
      fetch(`/api/settings/approval-policies?organization_id=${selectedPolicyOrgId}`).then((r) => r.json()),
      fetch(`/api/settings/members?organization_id=${selectedPolicyOrgId}`).then((r) => r.json()),
    ]).then(([pol, mem]) => {
      setPolicies(Array.isArray(pol) ? pol : []);
      setPolicyMembers(Array.isArray(mem) ? mem : []);
      setEditingPolicy(null);
      setIsNewPolicy(false);
    }).finally(() => setPoliciesLoading(false));
  }, [selectedPolicyOrgId, org]);

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
          {SECTIONS.filter((s) => {
            // 조직/멤버/승인정책은 본사(루트) 계정만 접근
            const rootOnly: SettingsSection[] = ['org', 'members', 'approval'];
            if (rootOnly.includes(s.key) && org && org.parent_id) return false;
            return true;
          }).map((s) => (
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
        {/* 본사 전용 섹션인데 지사 업무 상태인 경우 안내 */}
        {(['org', 'members', 'approval'] as SettingsSection[]).includes(activeSection)
          && isRootAccount && !isHqScope && (
          <HqOnlyNotice sectionLabel={SECTIONS.find((s) => s.key === activeSection)?.label ?? ''} />
        )}

        {/* 조직 관리 */}
        {activeSection === 'org' && isHqScope && org && (
          <>
            <div className={panel.detailHeader}>
              <div className={panel.detailTitle}>조직 관리</div>
            </div>

            {/* 조직 기본 정보 */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 12 }}>기본 정보</div>
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
                <ActionButton label="저장" variant="primary" size="md" onClick={async () => {
                  if (!orgName.trim()) { toast({ title: '조직명을 입력해주세요', variant: 'warning' }); return; }
                  try {
                    const res = await fetch('/api/settings/org', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: orgName.trim() }),
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      toast({ title: err?.error?.message || '저장에 실패했습니다', variant: 'error' });
                      return;
                    }
                    const updated = await res.json();
                    setOrg(updated);
                    setOrgName(updated.name);
                    toast({ title: '조직명이 변경되었습니다', variant: 'success' });
                  } catch {
                    toast({ title: '저장에 실패했습니다', variant: 'error' });
                  }
                }} />
              </div>
            </div>

            {/* 하위 조직 관리 */}
            <DepartmentSection
              departments={departments}
              setDepartments={setDepartments}
              toast={toast}
              confirm={confirm}
            />
          </>
        )}

        {/* 멤버 관리 */}
        {activeSection === 'members' && isHqScope && (
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
                  <tr><th>이름</th><th>이메일</th><th>조직</th><th>역할</th><th>상태</th><th>가입일</th><th></th></tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{m.name}</td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{m.email}</td>
                      <td>
                        <select
                          value={m.organization_id}
                          onChange={async (e) => {
                            const newOrgId = e.target.value;
                            try {
                              const res = await fetch(`/api/settings/members/${m.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ organization_id: newOrgId }),
                              });
                              if (!res.ok) {
                                toast({ title: '조직 변경에 실패했습니다', variant: 'error' });
                                return;
                              }
                              setMembers((prev) => prev.map((x) => x.id === m.id ? { ...x, organization_id: newOrgId } : x));
                              toast({ title: '조직이 변경되었습니다', variant: 'success' });
                            } catch {
                              toast({ title: '조직 변경에 실패했습니다', variant: 'error' });
                            }
                          }}
                          className="form-input"
                          style={{ fontSize: 12, width: 120, padding: '4px 6px' }}
                        >
                          {org && <option value={org.id}>{org.name}</option>}
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </td>
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
                departments={departments}
                toast={toast}
              />
            )}
          </>
        )}

        {/* 승인 정책 */}
        {activeSection === 'approval' && isHqScope && (
          <ApprovalPolicySection
            policies={policies}
            setPolicies={setPolicies}
            members={policyMembers}
            editingPolicy={editingPolicy}
            setEditingPolicy={setEditingPolicy}
            isNewPolicy={isNewPolicy}
            setIsNewPolicy={setIsNewPolicy}
            toast={toast}
            confirm={confirm}
            policyOrgs={policyOrgs}
            selectedPolicyOrgId={selectedPolicyOrgId}
            setSelectedPolicyOrgId={setSelectedPolicyOrgId}
            policiesLoading={policiesLoading}
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
            categories={estimateCategories}
            setCategories={setEstimateCategories}
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
            categories={executionCategories}
            setCategories={setExecutionCategories}
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

// ── HQ-only Notice ──────────────────────────────────────
function HqOnlyNotice({ sectionLabel }: { sectionLabel: string }) {
  return (
    <div className="card" style={{ padding: '32px 28px', textAlign: 'center', maxWidth: 560, margin: '24px auto' }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: 'var(--color-primary-soft, rgba(59,130,246,0.12))',
        color: 'var(--color-primary)',
        marginBottom: 16,
      }}>
        <LuBuilding2 size={24} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
        본사 전용 업무입니다
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
        {sectionLabel ? `"${sectionLabel}" 페이지는 본사 업무에서만 이용할 수 있습니다.` : '이 페이지는 본사 업무에서만 이용할 수 있습니다.'}
        <br />
        상단 우측의 업무 전환 메뉴에서 <strong>본사 업무</strong>로 전환해주시길 바랍니다.
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
  policyOrgs, selectedPolicyOrgId, setSelectedPolicyOrgId, policiesLoading,
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
  policyOrgs: { id: string; name: string; parent_id: string | null }[];
  selectedPolicyOrgId: string | null;
  setSelectedPolicyOrgId: (id: string) => void;
  policiesLoading: boolean;
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
        ...(selectedPolicyOrgId ? { organization_id: selectedPolicyOrgId } : {}),
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
          <div className={panel.detailSubtitle}>
            {policyOrgs.length > 0
              ? '본사 / 지사별로 승인 정책을 개별 관리합니다'
              : '문서 유형별 승인 규칙을 설정합니다'}
          </div>
        </div>
        {policyOrgs.length > 0 && (
          <div className={panel.detailActions} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>대상 조직</span>
            <select
              className="form-input"
              value={selectedPolicyOrgId ?? ''}
              onChange={(e) => setSelectedPolicyOrgId(e.target.value)}
              style={{ minWidth: 180, fontSize: 13 }}
              disabled={policiesLoading}
            >
              {policyOrgs
                .slice()
                .sort((a, b) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.parent_id ? `${o.name} (지사)` : `${o.name} (본사)`}
                  </option>
                ))}
            </select>
          </div>
        )}
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

interface CatalogEditModalProps {
  editing: CatalogItem;
  setEditing: React.Dispatch<React.SetStateAction<CatalogItem | null>>;
  isNew: boolean;
  saving: boolean;
  catalogType: 'estimate' | 'execution';
  categories: CatalogCategory[];
  details: Array<{ title: string; descriptions: string[] }>;
  setDetails: React.Dispatch<React.SetStateAction<Array<{ title: string; descriptions: string[] }>>>;
  note: string;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  options: Array<{ name: string; price: number }>;
  setOptions: React.Dispatch<React.SetStateAction<Array<{ name: string; price: number }>>>;
  icon: string;
  setIcon: React.Dispatch<React.SetStateAction<string>>;
  fields: Array<{ label: string; value: string }>;
  setFields: React.Dispatch<React.SetStateAction<Array<{ label: string; value: string }>>>;
  onSave: () => void;
  onCancel: () => void;
}

function CategoryCreateModal({
  name, setName, saving, onSave, onCancel,
}: {
  name: string;
  setName: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onCancel]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17,24,39,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--color-surface, #fff)',
          borderRadius: 10,
          width: '92vw',
          maxWidth: 420,
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>새 카테고리 추가</div>
          <button type="button" onClick={onCancel} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2 }} title="닫기">
            <LuX size={16} />
          </button>
        </div>
        <div style={{ padding: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
            카테고리명 <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="예: 일반, 특수 등"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim() && !saving) onSave();
            }}
            autoFocus
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton label="취소" variant="ghost" size="sm" onClick={onCancel} disabled={saving} />
          <ActionButton label={saving ? '추가 중...' : '추가'} variant="primary" size="sm" onClick={onSave} disabled={saving || !name.trim()} />
        </div>
      </div>
    </div>
  );
}

function CatalogEditModal({
  editing, setEditing, isNew, saving, catalogType, categories,
  details, setDetails, note, setNote, options, setOptions,
  icon, setIcon, fields, setFields, onSave, onCancel,
}: CatalogEditModalProps) {
  // ESC 키로 취소
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onCancel]);

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
    marginBottom: 10, paddingBottom: 6,
    borderBottom: '1px solid var(--color-border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  };
  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)',
    marginBottom: 4, display: 'block',
  };
  const iconBtnStyle: React.CSSProperties = {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--color-text-muted)', padding: 6, borderRadius: 4,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(17,24,39,0.55)',
      backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        background: 'var(--color-bg-elevated, #fff)',
        borderRadius: 14,
        boxShadow: '0 24px 72px rgba(0,0,0,0.28)',
        width: '92vw', maxWidth: 760,
        maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header (sticky) */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {isNew ? '새 항목 추가' : '항목 수정'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {catalogType === 'estimate' ? '견적서 카탈로그' : '집행 카탈로그'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* 활성 토글 */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                style={{ cursor: 'pointer' }}
              />
              <span>{editing.is_active ? '활성' : '비활성'}</span>
            </label>
            <button type="button" onClick={onCancel} disabled={saving} style={{ ...iconBtnStyle, padding: 8 }} title="닫기 (ESC)">
              <LuX size={18} />
            </button>
          </div>
        </div>

        {/* Body (scrollable) */}
        <div style={{ padding: '20px 24px', overflow: 'auto', flex: 1 }}>
          {/* 기본 정보 */}
          <div style={{ marginBottom: 24 }}>
            <div style={sectionLabelStyle}>기본 정보</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 12 }}>
              <div>
                <label style={fieldLabelStyle}>카테고리</label>
                <select
                  className="form-input"
                  value={editing.category_id ?? ''}
                  onChange={(e) => {
                    const catId = e.target.value || null;
                    const catName = categories.find((c) => c.id === catId)?.name ?? '';
                    setEditing({ ...editing, category_id: catId, group_name: catName });
                  }}
                >
                  <option value="">미분류</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={fieldLabelStyle}>항목명 <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 네이버 SA 광고"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label style={fieldLabelStyle}>기본 단가 (원)</label>
                <input
                  type="number"
                  className="form-input"
                  value={editing.base_price}
                  onChange={(e) => setEditing({ ...editing, base_price: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* 견적서 카탈로그 */}
          {catalogType === 'estimate' && (
            <>
              {/* 상세 내용 */}
              <div style={{ marginBottom: 24 }}>
                <div style={sectionLabelStyle}>
                  <span>상세 내용</span>
                  <button
                    type="button"
                    onClick={() => setDetails([...details, { title: '', descriptions: [''] }])}
                    style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 4, textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}
                  >
                    <LuPlus size={12} /> 상세 추가
                  </button>
                </div>
                {details.map((d, di) => (
                  <div key={di} style={{ marginBottom: 10, padding: 12, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg, #fafafa)', position: 'relative' }}>
                    {details.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDetails(details.filter((_, i) => i !== di))}
                        style={{ ...iconBtnStyle, position: 'absolute', top: 6, right: 6 }}
                        title="삭제"
                      >
                        <LuX size={14} />
                      </button>
                    )}
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
                      style={{ marginBottom: 8, fontWeight: 600, paddingRight: 32 }}
                    />
                    {d.descriptions.map((desc, dsi) => (
                      <div key={dsi} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, paddingLeft: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 10 }}>·</span>
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
                            style={iconBtnStyle}
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
                      style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 0 18px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <LuPlus size={11} /> 설명 추가
                    </button>
                  </div>
                ))}
              </div>

              {/* 비고 */}
              <div style={{ marginBottom: 24 }}>
                <div style={sectionLabelStyle}>비고</div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 월 정기결제"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {/* 옵션 */}
              <div style={{ marginBottom: 8 }}>
                <div style={sectionLabelStyle}>
                  <span>옵션 ({options.length}개)</span>
                  <button
                    type="button"
                    onClick={() => setOptions([...options, { name: '', price: 0 }])}
                    style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 4, textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}
                  >
                    <LuPlus size={12} /> 옵션 추가
                  </button>
                </div>
                {options.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', padding: '12px 0' }}>
                    옵션이 없습니다.
                  </div>
                )}
                {options.map((opt, oi) => (
                  <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
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
                      style={iconBtnStyle}
                      title="삭제"
                    >
                      <LuTrash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 집행 카탈로그 */}
          {catalogType === 'execution' && (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={sectionLabelStyle}>아이콘</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {EXECUTION_ICONS.map((ic) => (
                    <button
                      key={ic.id}
                      type="button"
                      title={ic.label}
                      onClick={() => setIcon(ic.id)}
                      style={{
                        width: 40, height: 40,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20,
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

              <div style={{ marginBottom: 8 }}>
                <div style={sectionLabelStyle}>
                  <span>필드 ({fields.length}개)</span>
                  <button
                    type="button"
                    onClick={() => setFields([...fields, { label: '', value: '' }])}
                    style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 4, textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}
                  >
                    <LuPlus size={12} /> 필드 추가
                  </button>
                </div>
                {fields.map((f, fi) => (
                  <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
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
                        style={iconBtnStyle}
                        title="삭제"
                      >
                        <LuTrash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer (sticky) */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, flexShrink: 0,
          background: 'var(--color-bg, #fafafa)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            ESC로 취소
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionButton label="취소" variant="ghost" size="sm" onClick={onCancel} disabled={saving} />
            <ActionButton label={saving ? '저장 중...' : '저장'} variant="primary" size="sm" onClick={onSave} disabled={saving} />
          </div>
        </div>
      </div>
    </div>
  );
}


function CatalogSection({
  catalogType, title, subtitle, items, setItems, categories, setCategories, toast, confirm,
}: {
  catalogType: 'estimate' | 'execution';
  title: string;
  subtitle: string;
  items: CatalogItem[];
  setItems: React.Dispatch<React.SetStateAction<CatalogItem[]>>;
  categories: CatalogCategory[];
  setCategories: React.Dispatch<React.SetStateAction<CatalogCategory[]>>;
  toast: (opts: ToastOptions) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  // category management state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // category drag-and-drop state
  const dragCatIdx = useRef<number | null>(null);
  const [dragOverCatIdx, setDragOverCatIdx] = useState<number | null>(null);

  const handleCategoryDragStart = (idx: number) => {
    dragCatIdx.current = idx;
  };

  const handleCategoryDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragCatIdx.current !== null && dragCatIdx.current !== idx) {
      setDragOverCatIdx(idx);
    }
  };

  const handleCategoryDrop = async (idx: number) => {
    const fromIdx = dragCatIdx.current;
    dragCatIdx.current = null;
    setDragOverCatIdx(null);
    if (fromIdx === null || fromIdx === idx) return;

    const reordered = [...categories];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(idx, 0, moved);

    const updated = reordered.map((c, i) => ({ ...c, sort_order: i }));
    setCategories(updated);

    try {
      const res = await fetch('/api/settings/catalog-categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: updated.map((c) => ({ id: c.id, sort_order: c.sort_order })) }),
      });
      if (!res.ok) {
        toast({ title: '정렬 저장에 실패했습니다', variant: 'error' });
        // rollback
        setCategories(categories);
      }
    } catch {
      toast({ title: '정렬 저장에 실패했습니다', variant: 'error' });
      setCategories(categories);
    }
  };

  const handleCategoryDragEnd = () => {
    dragCatIdx.current = null;
    setDragOverCatIdx(null);
  };

  // item drag-and-drop state (항목 자체 순서 조정)
  const dragItemId = useRef<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  const handleItemDragStart = (e: React.DragEvent, itemId: string) => {
    dragItemId.current = itemId;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleItemDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    if (dragItemId.current && dragItemId.current !== itemId) {
      setDragOverItemId(itemId);
    }
  };

  const handleItemDragLeave = (itemId: string) => {
    if (dragOverItemId === itemId) setDragOverItemId(null);
  };

  const handleItemDragEnd = () => {
    dragItemId.current = null;
    setDragOverItemId(null);
  };

  const handleItemDrop = async (targetId: string) => {
    const fromId = dragItemId.current;
    dragItemId.current = null;
    setDragOverItemId(null);
    if (!fromId || fromId === targetId) return;

    const fromItem = items.find((i) => i.id === fromId);
    const targetItem = items.find((i) => i.id === targetId);
    if (!fromItem || !targetItem) return;

    // 같은 카테고리 내에서만 순서 조정 (다른 카테고리로 이동 시 category_id도 변경)
    const movingToNewCategory = fromItem.category_id !== targetItem.category_id;

    // 전체 목록을 sort_order로 정렬 후 재배치
    const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const fromIdx = ordered.findIndex((i) => i.id === fromId);
    const targetIdx = ordered.findIndex((i) => i.id === targetId);
    if (fromIdx < 0 || targetIdx < 0) return;

    const [moved] = ordered.splice(fromIdx, 1);
    if (movingToNewCategory) {
      moved.category_id = targetItem.category_id;
      moved.group_name = targetItem.group_name;
    }
    ordered.splice(targetIdx, 0, moved);

    const updated = ordered.map((it, i) => ({ ...it, sort_order: i }));
    const prevItems = items;
    setItems(updated);

    try {
      const res = await fetch('/api/settings/catalogs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: updated.map((it) => ({ id: it.id, sort_order: it.sort_order })) }),
      });
      if (!res.ok) {
        toast({ title: '정렬 저장에 실패했습니다', variant: 'error' });
        setItems(prevItems);
        return;
      }
      // 카테고리 변경이 있으면 해당 항목만 추가 업데이트
      if (movingToNewCategory) {
        await fetch(`/api/settings/catalogs/${moved.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category_id: moved.category_id, group_name: moved.group_name }),
        });
      }
    } catch {
      toast({ title: '정렬 저장에 실패했습니다', variant: 'error' });
      setItems(prevItems);
    }
  };

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

  // ── Category CRUD handlers ──
  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || addingCategory) return;
    setAddingCategory(true);
    try {
      const res = await fetch('/api/settings/catalog-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalog_type: catalogType, name: newCategoryName.trim(), sort_order: categories.length }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err?.error?.message || '카테고리 추가에 실패했습니다', variant: 'error' });
        return;
      }
      const created = await res.json();
      setCategories((prev) => [...prev, created]);
      setNewCategoryName('');
      setShowCategoryModal(false);
      toast({ title: `"${created.name}" 카테고리가 추가되었습니다`, variant: 'success' });
    } catch {
      toast({ title: '카테고리 추가에 실패했습니다', variant: 'error' });
    } finally {
      setAddingCategory(false);
    }
  };

  const handleUpdateCategory = async (cat: CatalogCategory) => {
    if (!editingCategoryName.trim()) return;
    try {
      const res = await fetch(`/api/settings/catalog-categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingCategoryName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err?.error?.message || '수정에 실패했습니다', variant: 'error' });
        return;
      }
      const updated = await res.json();
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingCategoryId(null);
      toast({ title: '카테고리명이 수정되었습니다', variant: 'success' });
    } catch {
      toast({ title: '수정에 실패했습니다', variant: 'error' });
    }
  };

  const handleDeleteCategory = async (cat: CatalogCategory) => {
    const linkedCount = items.filter((i) => i.category_id === cat.id).length;
    const ok = await confirm({
      title: `"${cat.name}" 카테고리를 삭제하시겠습니까?`,
      description: linkedCount > 0
        ? `이 카테고리에 연결된 ${linkedCount}개 항목은 "미분류"로 변경됩니다.`
        : '삭제 후 복구할 수 없습니다.',
      variant: 'danger',
      confirmLabel: '삭제',
      cancelLabel: '취소',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/settings/catalog-categories/${cat.id}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== cat.id));
        // 연결된 카탈로그 항목의 category_id를 null로 업데이트 (UI 반영)
        setItems((prev) => prev.map((i) => i.category_id === cat.id ? { ...i, category_id: null, group_name: '' } : i));
        toast({ title: '카테고리가 삭제되었습니다', variant: 'success' });
      } else {
        toast({ title: '삭제에 실패했습니다', variant: 'error' });
      }
    } catch {
      toast({ title: '삭제에 실패했습니다', variant: 'error' });
    }
  };

  const handleNew = () => {
    const item: CatalogItem = {
      id: '',
      catalog_type: catalogType,
      group_name: '',
      category_id: null,
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

  const handleDuplicate = async (item: CatalogItem) => {
    const payload = {
      catalog_type: catalogType,
      group_name: item.group_name,
      category_id: item.category_id,
      name: `${item.name} (복사)`,
      sort_order: items.length + 1,
      base_price: item.base_price,
      content: item.content,
      is_active: item.is_active,
    };
    try {
      const res = await fetch('/api/settings/catalogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setItems((prev) => [...prev, created]);
        toast({ title: '항목이 복제되었습니다', variant: 'success' });
      } else {
        toast({ title: '복제에 실패했습니다', variant: 'error' });
      }
    } catch {
      toast({ title: '복제에 실패했습니다', variant: 'error' });
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
        category_id: editing.category_id,
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

  // ── 복수 선택 (Ctrl/Shift 지원) ─────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const flatOrderedIds = useMemo(() => {
    const groupKeys = [
      ...categories.map((c) => c.id),
      ...(sortedItems.some((i) => !i.category_id) ? ['__uncategorized__'] : []),
    ];
    const result: string[] = [];
    for (const key of groupKeys) {
      const isUncat = key === '__uncategorized__';
      const gi = sortedItems.filter((i) => (isUncat ? !i.category_id : i.category_id === key));
      for (const it of gi) result.push(it.id);
    }
    return result;
  }, [sortedItems, categories]);

  // 유효하지 않은 선택 항목 정리 (삭제/카탈로그 전환 시)
  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(items.map((i) => i.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [items]);

  const clearSelection = () => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  };

  const handleCardClick = (e: React.MouseEvent, itemId: string) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.shiftKey && lastSelectedId) {
      const a = flatOrderedIds.indexOf(lastSelectedId);
      const b = flatOrderedIds.indexOf(itemId);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const range = flatOrderedIds.slice(lo, hi + 1);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          range.forEach((id) => next.add(id));
          return next;
        });
      }
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(itemId)) next.delete(itemId);
        else next.add(itemId);
        return next;
      });
      setLastSelectedId(itemId);
    } else {
      setSelectedIds((prev) => {
        if (prev.size === 1 && prev.has(itemId)) return new Set();
        return new Set([itemId]);
      });
      setLastSelectedId(itemId);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `${ids.length}개 항목을 삭제하시겠습니까?`,
      description: '삭제 후 복구할 수 없습니다.',
      variant: 'danger',
      confirmLabel: '삭제',
      cancelLabel: '취소',
    });
    if (!ok) return;
    const results = await Promise.all(
      ids.map((id) => fetch(`/api/settings/catalogs/${id}`, { method: 'DELETE' })),
    );
    const successIds = ids.filter((_, i) => results[i].ok);
    if (successIds.length > 0) {
      setItems((prev) => prev.filter((x) => !successIds.includes(x.id)));
    }
    if (successIds.length === ids.length) {
      toast({ title: `${successIds.length}개 항목이 삭제되었습니다`, variant: 'success' });
    } else {
      toast({ title: `${successIds.length}/${ids.length}개 삭제됨, 일부 실패`, variant: 'warning' });
    }
    clearSelection();
  };

  const handleBulkMoveCategory = async (categoryId: string | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const newGroupName = categoryId
      ? (categories.find((c) => c.id === categoryId)?.name ?? '')
      : '';
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/settings/catalogs/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category_id: categoryId, group_name: newGroupName }),
        }),
      ),
    );
    const successIds = ids.filter((_, i) => results[i].ok);
    if (successIds.length > 0) {
      setItems((prev) =>
        prev.map((it) =>
          successIds.includes(it.id)
            ? { ...it, category_id: categoryId, group_name: newGroupName }
            : it,
        ),
      );
    }
    if (successIds.length === ids.length) {
      toast({
        title: `${successIds.length}개 항목이 ${categoryId ? '이동' : '미분류로 변경'}되었습니다`,
        variant: 'success',
      });
    } else {
      toast({ title: `${successIds.length}/${ids.length}개 이동됨`, variant: 'warning' });
    }
    clearSelection();
  };

  return (
    <>
      <div className={panel.detailHeader}>
        <div>
          <div className={panel.detailTitle}>{title}</div>
          <div className={panel.detailSubtitle}>{subtitle}</div>
        </div>
        <div className={panel.detailActions}>
          <ActionButton
            label="+ 카테고리"
            variant="ghost"
            size="sm"
            onClick={() => { setNewCategoryName(''); setShowCategoryModal(true); }}
          />
          <ActionButton label="+ 항목 추가" variant="primary" size="sm" onClick={handleNew} />
        </div>
      </div>

      {/* 카테고리 추가 모달 */}
      {showCategoryModal && (
        <CategoryCreateModal
          name={newCategoryName}
          setName={setNewCategoryName}
          saving={addingCategory}
          onSave={handleAddCategory}
          onCancel={() => { setShowCategoryModal(false); setNewCategoryName(''); }}
        />
      )}

      {/* 편집 모달 */}
      {editing && (
        <CatalogEditModal
          editing={editing}
          setEditing={setEditing}
          isNew={isNew}
          saving={saving}
          catalogType={catalogType}
          categories={categories}
          details={details}
          setDetails={setDetails}
          note={note}
          setNote={setNote}
          options={options}
          setOptions={setOptions}
          icon={icon}
          setIcon={setIcon}
          fields={fields}
          setFields={setFields}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      {/* 카탈로그 목록 (카테고리별 그룹핑) */}
      {sortedItems.length === 0 && !editing && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
          카탈로그 항목이 없습니다. 항목을 추가하면 에디터에서 사용할 수 있습니다.
        </div>
      )}

      {/* 선택 도움말 */}
      {sortedItems.length > 0 && selectedIds.size === 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>
          💡 항목을 클릭하여 선택 · Ctrl+클릭: 개별 선택 · Shift+클릭: 범위 선택
        </div>
      )}

      {/* 복수 선택 액션 바 */}
      {selectedIds.size > 0 && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: 'var(--color-primary, #3b82f6)',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600 }}>
            <LuCheck size={16} />
            {selectedIds.size}개 선택됨
            <button
              type="button"
              onClick={clearSelection}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: '#fff',
                padding: '2px 8px',
                fontSize: 11,
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              선택 해제
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              카테고리 이동:
              <select
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  handleBulkMoveCategory(v === '__uncategorized__' ? null : v);
                  e.target.value = '';
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.4)',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <option value="" style={{ color: '#000' }}>선택...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id} style={{ color: '#000' }}>{c.name}</option>
                ))}
                <option value="__uncategorized__" style={{ color: '#000' }}>미분류</option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleBulkDelete}
              style={{
                background: 'rgba(239,68,68,0.9)',
                border: 'none',
                color: '#fff',
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <LuTrash2 size={13} /> 선택 삭제
            </button>
          </div>
        </div>
      )}

      {(() => {
        // category_id 기반 그룹핑 (카테고리 없는 항목은 '미분류')
        const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
        const groupKeys = [
          ...categories.map((c) => c.id),
          ...(sortedItems.some((i) => !i.category_id) ? ['__uncategorized__'] : []),
        ];
        return groupKeys.map((key) => {
          const isUncategorized = key === '__uncategorized__';
          const groupItems = sortedItems.filter((i) =>
            isUncategorized ? !i.category_id : i.category_id === key,
          );
          if (groupItems.length === 0 && isUncategorized) return null;
          const groupLabel = isUncategorized ? '미분류' : (categoryMap.get(key) ?? '미분류');
          const catIdx = isUncategorized ? -1 : categories.findIndex((c) => c.id === key);
          const cat = isUncategorized ? null : categories[catIdx];
          const isEditingThisCat = cat && editingCategoryId === cat.id;
          return (
            <div key={key} style={{ marginBottom: 16 }}>
              <div
                draggable={!isUncategorized && !isEditingThisCat}
                onDragStart={() => { if (!isUncategorized && !isEditingThisCat) handleCategoryDragStart(catIdx); }}
                onDragOver={(e) => { if (!isUncategorized) handleCategoryDragOver(e, catIdx); }}
                onDrop={() => { if (!isUncategorized) handleCategoryDrop(catIdx); }}
                onDragEnd={handleCategoryDragEnd}
                style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--color-border)',
                  borderTop: (!isUncategorized && dragOverCatIdx === catIdx) ? '2px solid var(--color-primary, #3b82f6)' : '2px solid transparent',
                  marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 6,
                  cursor: isUncategorized || isEditingThisCat ? 'default' : 'grab',
                  transition: 'border-top 0.1s',
                }}
              >
                {!isUncategorized && <LuGripVertical size={12} style={{ opacity: 0.5 }} />}
                <LuBookOpen size={12} />
                {isEditingThisCat && cat ? (
                  <>
                    <input
                      type="text"
                      className="form-input"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateCategory(cat);
                        if (e.key === 'Escape') setEditingCategoryId(null);
                      }}
                      autoFocus
                      style={{ fontSize: 12, padding: '2px 6px', flex: 1, maxWidth: 220 }}
                    />
                    <button type="button" onClick={() => handleUpdateCategory(cat)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 2 }} title="저장">
                      <LuCheck size={13} />
                    </button>
                    <button type="button" onClick={() => setEditingCategoryId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2 }} title="취소">
                      <LuX size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    {groupLabel}
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)' }}>({groupItems.length})</span>
                    {!isUncategorized && cat && (
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                        <button type="button" onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2 }} title="카테고리명 수정">
                          <LuPencil size={12} />
                        </button>
                        <button type="button" onClick={() => handleDeleteCategory(cat)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2 }} title="카테고리 삭제">
                          <LuTrash2 size={12} />
                        </button>
                      </span>
                    )}
                  </>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {groupItems.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '12px 4px', gridColumn: '1 / -1' }}>
                  항목이 없습니다. 항목을 여기에 드래그하거나 &quot;+ 항목 추가&quot;로 추가하세요.
                </div>
              )}
              {groupItems.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                <div
                  key={item.id}
                  className="card"
                  draggable
                  onClick={(e) => handleCardClick(e, item.id)}
                  onDragStart={(e) => handleItemDragStart(e, item.id)}
                  onDragOver={(e) => handleItemDragOver(e, item.id)}
                  onDragLeave={() => handleItemDragLeave(item.id)}
                  onDrop={() => handleItemDrop(item.id)}
                  onDragEnd={handleItemDragEnd}
                  style={{
                    padding: '10px 12px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    minHeight: 80,
                    cursor: 'grab',
                    outline: dragOverItemId === item.id
                      ? '2px solid var(--color-primary, #3b82f6)'
                      : isSelected
                        ? '2px solid var(--color-primary, #3b82f6)'
                        : 'none',
                    outlineOffset: -2,
                    background: isSelected ? 'rgba(59, 130, 246, 0.08)' : undefined,
                    opacity: dragItemId.current === item.id ? 0.5 : 1,
                    transition: 'outline 0.1s, background 0.1s',
                    userSelect: 'none',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3, wordBreak: 'break-word' }}>
                      {catalogType === 'execution' && (
                        <span style={{ marginRight: 4 }}>
                          {EXECUTION_ICONS.find((ic) => ic.id === (item.content as Record<string, unknown>)?.icon)?.emoji ?? '📋'}
                        </span>
                      )}
                      {item.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>
                      {fmtKRW(item.base_price)}
                      {catalogType === 'estimate' && (item.content as Record<string, unknown>)?.note ? (
                        <span style={{ marginLeft: 6 }}>· {String((item.content as Record<string, unknown>).note)}</span>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <span className={`badge badge-sm ${item.is_active ? 'badge-green' : 'badge-slate'}`}>{item.is_active ? '활성' : '비활성'}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button type="button" onClick={() => handleEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }} title="수정">
                        <LuPencil size={13} />
                      </button>
                      <button type="button" onClick={() => handleDuplicate(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }} title="복제">
                        <LuCopy size={13} />
                      </button>
                      <button type="button" onClick={() => handleDelete(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }} title="삭제">
                        <LuTrash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
              </div>
            </div>
          );
        });
      })()}
    </>
  );
}

// ── Department Section (조직 관리) ──────────────────────

function DepartmentSection({
  departments, setDepartments, toast, confirm,
}: {
  departments: SubOrgItem[];
  setDepartments: React.Dispatch<React.SetStateAction<SubOrgItem[]>>;
  toast: (opts: ToastOptions) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = async () => {
    if (!newName.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch('/api/settings/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err?.error?.message || '추가에 실패했습니다', variant: 'error' });
        return;
      }
      const created = await res.json();
      setDepartments((prev) => [...prev, created]);
      setNewName('');
      toast({ title: `"${created.name}" 조직이 추가되었습니다`, variant: 'success' });
    } catch {
      toast({ title: '추가에 실패했습니다', variant: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (dept: SubOrgItem) => {
    if (!editingName.trim()) return;
    try {
      const res = await fetch(`/api/settings/departments/${dept.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err?.error?.message || '수정에 실패했습니다', variant: 'error' });
        return;
      }
      const updated = await res.json();
      setDepartments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setEditingId(null);
      toast({ title: '조직명이 수정되었습니다', variant: 'success' });
    } catch {
      toast({ title: '수정에 실패했습니다', variant: 'error' });
    }
  };

  const handleDelete = async (dept: SubOrgItem) => {
    const ok = await confirm({
      title: `"${dept.name}" 조직을 삭제하시겠습니까?`,
      description: '해당 조직에 소속된 멤버는 "미지정" 상태가 됩니다.',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/settings/departments/${dept.id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast({ title: '삭제에 실패했습니다', variant: 'error' });
        return;
      }
      setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
      toast({ title: `"${dept.name}" 조직이 삭제되었습니다`, variant: 'success' });
    } catch {
      toast({ title: '삭제에 실패했습니다', variant: 'error' });
    }
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 12 }}>하위 조직</div>
      {/* <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        부서·팀 등의 하위 조직을 관리합니다. 멤버 초대 시 조직을 지정할 수 있습니다. (최대 3개, 현재 {departments.length}개)
      </div> */}

      {/* 추가 폼 */}
      {/* <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="새 조직 이름"
          className="form-input"
          style={{ flex: 1, maxWidth: 280 }}
        />
        <ActionButton label={adding ? '추가 중...' : '+ 추가'} variant="primary" size="sm" onClick={handleAdd} disabled={!newName.trim() || adding || departments.length >= 3} />
      </div> */}

      {/* 목록 */}
      {departments.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, background: 'var(--color-bg)', borderRadius: 'var(--radius)' }}>
          등록된 조직이 없습니다
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {departments.map((dept) => (
            <div
              key={dept.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', background: 'var(--color-bg)',
                borderRadius: 'var(--radius)', border: '1px solid var(--color-border)',
              }}
            >
              {editingId === dept.id ? (
                <>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate(dept)}
                    className="form-input"
                    style={{ flex: 1, fontSize: 13 }}
                    autoFocus
                  />
                  <button type="button" onClick={() => handleUpdate(dept)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 4 }} title="저장">
                    <LuCheck size={14} />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }} title="취소">
                    <LuX size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{dept.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{formatDate(dept.created_at)}</span>
                  <button type="button" onClick={() => { setEditingId(dept.id); setEditingName(dept.name); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }} title="수정">
                    <LuPencil size={14} />
                  </button>
                  <button type="button" onClick={() => handleDelete(dept)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger, #ef4444)', padding: 4 }} title="삭제">
                    <LuTrash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
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
  onClose, onInvited, departments, toast,
}: {
  onClose: () => void;
  onInvited: (member: MemberItem) => void;
  departments: SubOrgItem[];
  toast: (opts: ToastOptions) => void;
}) {
  const [candidates, setCandidates] = useState<InviteCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('member');
  const [selectedSubOrgId, setSelectedSubOrgId] = useState<string>('');
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
        body: JSON.stringify({ authId: selectedId, role: selectedRole, subOrgId: selectedSubOrgId || undefined }),
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

  const TIER_LABEL: Record<string, string> = { admin: '관리자', manager: '매니저', branch: '지점' };

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

        {/* 하단 역할/조직 선택 + 초대 버튼 */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
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
          <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', flexShrink: 0 }}>조직</label>
          <select
            value={selectedSubOrgId}
            onChange={(e) => setSelectedSubOrgId(e.target.value)}
            className="form-input"
            style={{ width: 120, fontSize: 12 }}
          >
            <option value="">본사</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
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