'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LuFolderOpen } from 'react-icons/lu';
import { StatusBadge, ActionButton } from '@/components/ui';
import type { ProjectStatus, ServiceType } from '@/lib/domain/types';
import { PROJECT_STATUSES, PROJECT_STATUS_META, SERVICE_TYPE_META } from '@/lib/domain/types';
import panel from '../panel-layout.module.css';

// ── Mock Data ────────────────────────────────────────────

interface ProjectItem {
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

const MOCK_PROJECTS: ProjectItem[] = [
  { id: 'p1', code: 'PRJ-2026-001', title: '블루오션 3월 마케팅 대행', clientName: '(주)블루오션 마케팅', status: 'running', serviceType: 'viral_performance', ownerName: '김민수', totalAmount: 3960000, startDate: '2026-03-15', endDate: '2026-05-31', updatedAt: '2026-03-28' },
  { id: 'p2', code: 'PRJ-2026-002', title: '그린텍 브랜드 프로젝트', clientName: '그린텍', status: 'contracted', serviceType: 'performance', ownerName: '이지현', totalAmount: 5500000, startDate: '2026-04-01', endDate: '2026-06-30', updatedAt: '2026-03-27' },
  { id: 'p3', code: 'PRJ-2026-003', title: '스카이미디어 SNS 대행', clientName: '스카이미디어', status: 'quoted', serviceType: 'viral', ownerName: '이지현', totalAmount: 2200000, startDate: null, endDate: null, updatedAt: '2026-03-26' },
  { id: 'p4', code: 'PRJ-2026-004', title: '하이브랜드 캠페인', clientName: '하이브랜드', status: 'draft', serviceType: 'viral_performance', ownerName: '김민수', totalAmount: null, startDate: null, endDate: null, updatedAt: '2026-03-25' },
  { id: 'p5', code: 'PRJ-2026-005', title: '오렌지원 봄시즌 바이럴', clientName: '오렌지원', status: 'completed', serviceType: 'viral', ownerName: '김민수', totalAmount: 1800000, startDate: '2026-02-01', endDate: '2026-03-20', updatedAt: '2026-03-24' },
  { id: 'p6', code: 'PRJ-2026-006', title: '모어마케팅 블로그 대행', clientName: '모어마케팅', status: 'paid', serviceType: 'performance', ownerName: '이지현', totalAmount: 3000000, startDate: '2026-04-01', endDate: '2026-06-30', updatedAt: '2026-03-23' },
  { id: 'p7', code: 'PRJ-2026-007', title: '레드스타 인플루언서 마케팅', clientName: '레드스타', status: 'rejected', serviceType: 'viral', ownerName: '이지현', totalAmount: 8000000, startDate: null, endDate: null, updatedAt: '2026-03-22' },
  { id: 'p8', code: 'PRJ-2026-008', title: '실버라인 광고 대행', clientName: '실버라인', status: 'cancelled', serviceType: 'viral_performance', ownerName: '김민수', totalAmount: 4500000, startDate: null, endDate: null, updatedAt: '2026-03-20' },
];

function formatCurrency(amount: number | null) {
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
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ProjectItem | null>(null);

  const filtered = MOCK_PROJECTS.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className={panel.wrapper}>
      {/* ── Left Panel ── */}
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <div className={panel.leftActions}>
            <span className={panel.leftTitle}>프로젝트</span>
            <Link href="/projects/new">
              <ActionButton label="+ 추가" variant="primary" size="sm" />
            </Link>
          </div>
          <input
            className={panel.searchInput}
            placeholder="프로젝트명, 고객사 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={panel.filterTabs}>
            <button
              type="button"
              className={`${panel.filterTab} ${statusFilter === 'all' ? panel.filterTabActive : ''}`}
              onClick={() => setStatusFilter('all')}
            >전체</button>
            {PROJECT_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`${panel.filterTab} ${statusFilter === s ? panel.filterTabActive : ''}`}
                onClick={() => setStatusFilter(s)}
              >{PROJECT_STATUS_META[s].label}</button>
            ))}
          </div>
        </div>

        <div className={panel.itemList}>
          {filtered.map((p) => (
            <div
              key={p.id}
              className={`${panel.item} ${selected?.id === p.id ? panel.itemActive : ''}`}
              onClick={() => setSelected(p)}
            >
              <span className={panel.itemName}>{p.title}</span>
              <span className={panel.itemMeta}>
                <span>{p.clientName}</span>
                <span>·</span>
                <StatusBadge status={p.status} type="project" />
              </span>
            </div>
          ))}
        </div>

        <div className={panel.leftFooter}>{filtered.length}개 프로젝트</div>
      </div>

      {/* ── Right Panel ── */}
      <div className={panel.rightPanel}>
        {!selected ? (
          <div className={panel.emptyState}>
            <span className={panel.emptyIcon}><LuFolderOpen size={32} /></span>
            <span>프로젝트를 선택하세요</span>
          </div>
        ) : (
          <>
            <div className={panel.detailHeader}>
              <div>
                <div className={panel.detailTitle}>{selected.title}</div>
                <div className={panel.detailSubtitle}>{selected.code} · {selected.clientName}</div>
              </div>
              <div className={panel.detailActions}>
                <Link href={`/projects/${selected.id}`}>
                  <ActionButton label="상세 보기" variant="secondary" size="sm" />
                </Link>
              </div>
            </div>

            <div className="card">
              <div className={panel.detailGrid}>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>상태</span>
                  <span className={panel.fieldValue}><StatusBadge status={selected.status} type="project" /></span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>서비스 유형</span>
                  <span className={panel.fieldValue}>{SERVICE_TYPE_META[selected.serviceType].label}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>담당자</span>
                  <span className={panel.fieldValue}>{selected.ownerName}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>금액</span>
                  <span className={panel.fieldValue}>{formatCurrency(selected.totalAmount)}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>시작일</span>
                  <span className={panel.fieldValue}>{formatDate(selected.startDate)}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>종료일</span>
                  <span className={panel.fieldValue}>{formatDate(selected.endDate)}</span>
                </div>
              </div>
            </div>

            <div className={panel.detailSection}>
              <div className={panel.detailSectionTitle}>문서</div>
              <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                이 프로젝트의 견적서, 계약서, 보고서가 여기에 표시됩니다.
              </div>
            </div>

            <div className={panel.detailSection}>
              <div className={panel.detailSectionTitle}>활동 로그</div>
              <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                최근 활동이 여기에 표시됩니다.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
