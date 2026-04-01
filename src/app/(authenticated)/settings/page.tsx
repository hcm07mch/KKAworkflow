'use client';

import { useState } from 'react';
import { ActionButton } from '@/components/ui';
import type { UserRole } from '@/lib/domain/types';
import { USER_ROLE_META } from '@/lib/domain/types';

// ── Mock 조직 / 멤버 데이터 ─────────────────────────────

const MOCK_ORG = {
  id: 'org1',
  name: 'KKA 마케팅',
  slug: 'kka-marketing',
  createdAt: '2026-01-05',
};

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

const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'badge-red',
  manager: 'badge-blue',
  member: 'badge-green',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Page ─────────────────────────────────────────────────

export default function SettingsPage() {
  const [orgName, setOrgName] = useState(MOCK_ORG.name);
  const [activeTab, setActiveTab] = useState<'org' | 'members' | 'approval'>('org');

  return (
    <div className="page-container">
      <h1 className="text-lg font-semibold text-gray-900">설정</h1>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'org', label: '조직 정보' },
          { key: 'members', label: '멤버 관리' },
          { key: 'approval', label: '승인 정책' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 조직 정보 탭 */}
      {activeTab === 'org' && (
        <div className="card">
          <h2 className="section-title mb-4">조직 정보</h2>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs text-gray-500 mb-1">조직명</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">슬러그</label>
              <input
                type="text"
                value={MOCK_ORG.slug}
                disabled
                className="form-input opacity-50"
              />
              <p className="text-[11px] text-gray-400 mt-1">슬러그는 변경할 수 없습니다</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">생성일</label>
              <p className="text-sm text-gray-700">{formatDate(MOCK_ORG.createdAt)}</p>
            </div>
            <div className="pt-2">
              <ActionButton
                label="저장"
                variant="primary"
                size="md"
                onClick={() => alert('조직 정보 저장 (TODO)')}
              />
            </div>
          </div>
        </div>
      )}

      {/* 멤버 관리 탭 */}
      {activeTab === 'members' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">총 {MOCK_MEMBERS.length}명의 멤버</p>
            <ActionButton
              label="+ 멤버 초대"
              variant="primary"
              size="md"
              onClick={() => alert('멤버 초대 (TODO)')}
            />
          </div>
          <div className="card" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>역할</th>
                  <th>상태</th>
                  <th>가입일</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {MOCK_MEMBERS.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium text-gray-900">{m.name}</td>
                    <td className="text-gray-500 text-xs">{m.email}</td>
                    <td>
                      <span className={`badge badge-sm ${ROLE_BADGE[m.role]}`}>
                        {USER_ROLE_META[m.role].label}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-sm ${m.isActive ? 'badge-green' : 'badge-slate'}`}>
                        {m.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="text-gray-400 text-xs">{formatDate(m.joinedAt)}</td>
                    <td>
                      <ActionButton
                        label="편집"
                        variant="ghost"
                        onClick={() => alert(`멤버 편집: ${m.name} (TODO)`)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 승인 정책 탭 */}
      {activeTab === 'approval' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">문서 유형별 승인 규칙을 설정합니다</p>
            <ActionButton
              label="+ 정책 추가"
              variant="primary"
              size="md"
              onClick={() => alert('승인 정책 추가 (TODO)')}
            />
          </div>

          {/* 기본 정책 */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">기본 승인 정책</h3>
                <p className="text-xs text-gray-400 mt-0.5">별도 정책이 없는 문서에 적용</p>
              </div>
              <span className="badge badge-sm badge-green">활성</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                  1단계: 담당자 승인
                </span>
                <span className="text-gray-300">→</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-medium">
                  2단계: 대표 승인
                </span>
              </div>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <ActionButton label="편집" variant="secondary" onClick={() => alert('정책 편집 (TODO)')} />
              <ActionButton label="비활성화" variant="danger" onClick={() => alert('정책 비활성화 (TODO)')} />
            </div>
          </div>

          {/* 견적서 정책 */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">견적서 승인 정책</h3>
                <p className="text-xs text-gray-400 mt-0.5">견적서 문서에만 적용</p>
              </div>
              <span className="badge badge-sm badge-green">활성</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                1단계: 담당자 승인
              </span>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <ActionButton label="편집" variant="secondary" onClick={() => alert('정책 편집 (TODO)')} />
              <ActionButton label="비활성화" variant="danger" onClick={() => alert('정책 비활성화 (TODO)')} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
