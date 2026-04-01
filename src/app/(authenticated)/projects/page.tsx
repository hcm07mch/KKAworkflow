'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StatusBadge, ActionButton } from '@/components/ui';
import type { ProjectStatus, ServiceType } from '@/lib/domain/types';
import { PROJECT_STATUSES, PROJECT_STATUS_META, SERVICE_TYPE_META } from '@/lib/domain/types';

// ── Mock 프로젝트 목록 데이터 ────────────────────────────

interface ProjectListItem {
  id: string;
  code: string;
  title: string;
  clientName: string;
  status: ProjectStatus;
  serviceType: ServiceType;
  ownerName: string;
  totalAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string;
}

const MOCK_PROJECTS: ProjectListItem[] = [
  {
    id: 'p1', code: 'PRJ-2026-001', title: '블루오션 3월 마케팅 대행',
    clientName: '(주)블루오션 마케팅', status: 'running', serviceType: 'viral_performance', ownerName: '김민수',
    totalAmount: 3960000, startDate: '2026-03-15', endDate: '2026-05-31', updatedAt: '2026-03-28',
  },
  {
    id: 'p2', code: 'PRJ-2026-002', title: '그린텍 브랜드 프로젝트',
    clientName: '그린텍', status: 'contracted', serviceType: 'performance', ownerName: '이지현',
    totalAmount: 5500000, startDate: '2026-04-01', endDate: '2026-06-30', updatedAt: '2026-03-27',
  },
  {
    id: 'p3', code: 'PRJ-2026-003', title: '스카이미디어 SNS 대행',
    clientName: '스카이미디어', status: 'quoted', serviceType: 'viral', ownerName: '이지현',
    totalAmount: 2200000, startDate: null, endDate: null, updatedAt: '2026-03-26',
  },
  {
    id: 'p4', code: 'PRJ-2026-004', title: '하이브랜드 캠페인',
    clientName: '하이브랜드', status: 'draft', serviceType: 'viral_performance', ownerName: '김민수',
    totalAmount: null, startDate: null, endDate: null, updatedAt: '2026-03-25',
  },
  {
    id: 'p5', code: 'PRJ-2026-005', title: '오렌지원 봄시즌 바이럴',
    clientName: '오렌지원', status: 'completed', serviceType: 'viral', ownerName: '김민수',
    totalAmount: 1800000, startDate: '2026-02-01', endDate: '2026-03-20', updatedAt: '2026-03-24',
  },
  {
    id: 'p6', code: 'PRJ-2026-006', title: '모어마케팅 블로그 대행',
    clientName: '모어마케팅', status: 'paid', serviceType: 'performance', ownerName: '이지현',
    totalAmount: 3000000, startDate: '2026-04-01', endDate: '2026-06-30', updatedAt: '2026-03-23',
  },
  {
    id: 'p7', code: 'PRJ-2026-007', title: '레드스타 인플루언서 마케팅',
    clientName: '레드스타', status: 'rejected', serviceType: 'viral', ownerName: '이지현',
    totalAmount: 8000000, startDate: null, endDate: null, updatedAt: '2026-03-22',
  },
  {
    id: 'p8', code: 'PRJ-2026-008', title: '실버라인 광고 대행',
    clientName: '실버라인', status: 'cancelled', serviceType: 'viral_performance', ownerName: '김민수',
    totalAmount: 4500000, startDate: null, endDate: null, updatedAt: '2026-03-20',
  },
];

function formatCurrency(amount: number | null): string {
  if (amount == null) return '-';
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

// ── Page ─────────────────────────────────────────────────

export default function ProjectsPage() {
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = MOCK_PROJECTS.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">프로젝트</h1>
        <Link href="/projects/new">
          <ActionButton
            label="+ 새 프로젝트"
            variant="primary"
            size="md"
          />
        </Link>
      </div>

      {/* 필터 / 검색 */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="프로젝트명, 고객사, 코드 검색..."
            className="form-input"
            style={{ maxWidth: 280 }}
          />

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            >
              전체
            </button>
            {PROJECT_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`}
              >
                {PROJECT_STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 프로젝트 테이블 */}
      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            조건에 맞는 프로젝트가 없습니다
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>코드</th>
                <th>프로젝트명</th>
                <th>고객사</th>
                <th>서비스 유형</th>
                <th>상태</th>
                <th>담당자</th>
                <th>금액</th>
                <th>기간</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="text-xs font-mono text-gray-400">{p.code}</td>
                  <td>
                    <Link href={`/projects/${p.id}`} className="font-medium text-gray-900 hover:text-brand">
                      {p.title}
                    </Link>
                  </td>
                  <td className="text-gray-500">{p.clientName}</td>
                  <td className="text-xs text-gray-600">{SERVICE_TYPE_META[p.serviceType].label}</td>
                  <td><StatusBadge status={p.status} type="project" /></td>
                  <td className="text-gray-500">{p.ownerName}</td>
                  <td className="text-gray-700 text-xs">{formatCurrency(p.totalAmount)}</td>
                  <td className="text-gray-400 text-xs">
                    {p.startDate ? `${formatDate(p.startDate)} ~ ${formatDate(p.endDate)}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-gray-400 text-right">
        총 {filtered.length}건 {statusFilter !== 'all' && `(${PROJECT_STATUS_META[statusFilter].label} 필터)`}
      </div>
    </div>
  );
}
