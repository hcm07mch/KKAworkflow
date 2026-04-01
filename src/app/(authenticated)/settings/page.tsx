'use client';

import { useState } from 'react';
import { LuBuilding2, LuUsers, LuShieldCheck } from 'react-icons/lu';
import { ActionButton } from '@/components/ui';
import type { UserRole } from '@/lib/domain/types';
import { USER_ROLE_META } from '@/lib/domain/types';
import panel from '../panel-layout.module.css';

// ── Mock Data ────────────────────────────────────────────

const MOCK_ORG = { id: 'org1', name: 'KKA 마케팅', slug: 'kka-marketing', createdAt: '2026-01-05' };

interface MemberItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  joinedAt: string;
}

const MOCK_MEMBERS: MemberItem[] = [
  { id: 'u3', name: '박대표', email: 'park@kka.co.kr', role: 'admin', isActive: true, joinedAt: '2026-01-05' },
  { id: 'u1', name: '김민수', email: 'kim@kka.co.kr', role: 'manager', isActive: true, joinedAt: '2026-01-10' },
  { id: 'u2', name: '이지현', email: 'lee@kka.co.kr', role: 'member', isActive: true, joinedAt: '2026-02-01' },
  { id: 'u4', name: '최영지', email: 'choi@kka.co.kr', role: 'member', isActive: true, joinedAt: '2026-03-01' },
  { id: 'u5', name: '한세영', email: 'han@kka.co.kr', role: 'member', isActive: false, joinedAt: '2026-02-15' },
];

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
  const [activeSection, setActiveSection] = useState<SettingsSection>('org');
  const [orgName, setOrgName] = useState(MOCK_ORG.name);

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
        {activeSection === 'org' && (
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
                  <span className={panel.fieldValue}>{MOCK_ORG.slug}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>생성일</span>
                  <span className={panel.fieldValue}>{formatDate(MOCK_ORG.createdAt)}</span>
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
                <div className={panel.detailSubtitle}>총 {MOCK_MEMBERS.length}명</div>
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
                  {MOCK_MEMBERS.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{m.name}</td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{m.email}</td>
                      <td><span className={`badge badge-sm ${ROLE_BADGE[m.role]}`}>{USER_ROLE_META[m.role].label}</span></td>
                      <td><span className={`badge badge-sm ${m.isActive ? 'badge-green' : 'badge-slate'}`}>{m.isActive ? '활성' : '비활성'}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{formatDate(m.joinedAt)}</td>
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
          <>
            <div className={panel.detailHeader}>
              <div>
                <div className={panel.detailTitle}>승인 정책</div>
                <div className={panel.detailSubtitle}>문서 유형별 승인 규칙을 설정합니다</div>
              </div>
              <div className={panel.detailActions}>
                <ActionButton label="+ 정책 추가" variant="primary" size="sm" onClick={() => alert('정책 추가 (TODO)')} />
              </div>
            </div>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>기본 승인 정책</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>별도 정책이 없는 문서에 적용</div>
                </div>
                <span className="badge badge-sm badge-green">활성</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-sm badge-blue">1단계: 담당자 승인</span>
                <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                <span className="badge badge-sm badge-red">2단계: 대표 승인</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
