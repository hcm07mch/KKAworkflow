'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LuFolderOpen, LuLoader, LuPlus } from 'react-icons/lu';
import { StatusBadge, ActionButton } from '@/components/ui';
import type { ProjectStatus, ServiceType } from '@/lib/domain/types';
import { PROJECT_STATUSES, PROJECT_STATUS_META, PROJECT_STATUS_GROUPS, SERVICE_TYPE_META } from '@/lib/domain/types';
import panel from '../panel-layout.module.css';

// ── Types ────────────────────────────────────────────────

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
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ProjectItem | null>(null);

  useEffect(() => {
    fetch('/api/projects?limit=200')
      .then((r) => r.json())
      .then((res) => {
        const items: ProjectItem[] = (res.data ?? []).map((p: any) => ({
          id: p.id,
          code: p.code ?? '',
          title: p.title,
          clientName: p.client?.name ?? '',
          status: p.status,
          serviceType: p.service_type,
          ownerName: p.owner?.name ?? '-',
          totalAmount: p.total_amount,
          startDate: p.start_date,
          endDate: p.end_date,
          updatedAt: p.updated_at,
        }));
        setProjects(items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = projects.filter((p) => {
    if (groupFilter !== 'all') {
      const group = PROJECT_STATUS_GROUPS.find(g => g.key === groupFilter);
      if (group && !group.statuses.includes(p.status)) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className={panel.wrapper} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <LuLoader size={24} className="spin" />
      </div>
    );
  }

  return (
    <div className={panel.wrapper}>
      {/* ── Left Panel ── */}
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <span className={panel.leftTitle}>프로젝트</span>
          <input
            className={panel.searchInput}
            placeholder="프로젝트명, 고객사 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={panel.filterTabs}>
            <button
              type="button"
              className={`${panel.filterTab} ${groupFilter === 'all' ? panel.filterTabActive : ''}`}
              onClick={() => setGroupFilter('all')}
            >전체</button>
            {PROJECT_STATUS_GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                className={`${panel.filterTab} ${groupFilter === g.key ? panel.filterTabActive : ''}`}
                onClick={() => setGroupFilter(g.key)}
              >{g.label}</button>
            ))}
          </div>
        </div>

        <div className={panel.itemList}>
          <Link href="/projects/new" className={panel.addItem}>
            <LuPlus size={14} /> 새 프로젝트
          </Link>
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
                  <span className={panel.fieldValue}>{SERVICE_TYPE_META[selected.serviceType]?.label ?? '-'}</span>
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