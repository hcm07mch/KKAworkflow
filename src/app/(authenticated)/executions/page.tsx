'use client';

import { useEffect, useState, useCallback } from 'react';
import { LuRocket, LuLoader } from 'react-icons/lu';
import { ActionButton } from '@/components/ui';
import { SERVICE_TYPE_META, PROJECT_STATUS_META } from '@/lib/domain/types';
import type { ServiceType, ProjectStatus } from '@/lib/domain/types';
import panel from '../panel-layout.module.css';

// ── Types ────────────────────────────────────────────────

interface ExecItem {
  id: string;
  projectTitle: string;
  clientName: string;
  ownerName: string;
  serviceType: ServiceType;
  projectStatus: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  budget: number;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
}
function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Page ─────────────────────────────────────────────────

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState<ExecItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('executions_ownerFilter') ?? 'all';
    }
    return 'all';
  });
  const [selected, setSelected] = useState<ExecItem | null>(null);

  const selectExecution = useCallback((ex: ExecItem) => {
    setSelected(ex);
    localStorage.setItem('executions_selectedId', ex.id);
  }, []);

  useEffect(() => {
    fetch('/api/projects?status=E1_prereport_draft,E2_prereport_review,E3_in_progress,E4_execution&limit=200')
      .then((r) => r.json())
      .then((res) => {
        const items: ExecItem[] = (res.data ?? []).map((p: any) => ({
          id: p.id,
          projectTitle: p.title,
          clientName: p.client?.name ?? '',
          ownerName: p.owner?.name ?? '-',
          serviceType: p.service_type,
          projectStatus: p.status,
          startDate: p.start_date,
          endDate: p.end_date,
          budget: p.total_amount ?? 0,
        }));
        setExecutions(items);
        setLoading(false);
        const savedId = localStorage.getItem('executions_selectedId');
        if (savedId) {
          const target = items.find((ex) => ex.id === savedId);
          if (target) setSelected(target);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const ownerNames = Array.from(new Set(executions.map((ex) => ex.ownerName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));

  const filtered = executions.filter((ex) => {
    if (filter !== 'all' && ex.projectStatus !== filter) return false;
    if (ownerFilter !== 'all' && ex.ownerName !== ownerFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return ex.projectTitle.toLowerCase().includes(q) || ex.clientName.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className={panel.wrapper}>
        <div className={panel.leftPanel}>
          <div className={panel.leftHeader}>
            <span className={panel.leftTitle}>집행 관리</span>
            <div className={panel.searchInput} style={{ opacity: 0.5 }} />
          </div>
          <div className={panel.itemList}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={panel.skeletonItem}>
                <div className={panel.skeletonBar} style={{ width: '65%' }} />
                <div className={panel.skeletonBar} style={{ width: '40%', height: 8 }} />
              </div>
            ))}
          </div>
        </div>
        <div className={panel.rightPanel}>
          <div className={panel.emptyState}>
            <span className={panel.emptyIcon}><LuRocket size={32} /></span>
            <span>프로젝트를 선택하세요</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={panel.wrapper}>
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <div className={panel.leftTitleRow}>
            <span className={panel.leftTitle}>집행 관리</span>
            <select
              className={panel.sortSelect}
              value={ownerFilter}
              onChange={(e) => {
                const v = e.target.value;
                setOwnerFilter(v);
                localStorage.setItem('executions_ownerFilter', v);
              }}
            >
              <option value="all">담당자: 전체</option>
              {ownerNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <input className={panel.searchInput} placeholder="프로젝트, 고객사 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className={panel.filterTabs}>
            <button type="button" className={`${panel.filterTab} ${filter === 'all' ? panel.filterTabActive : ''}`} onClick={() => setFilter('all')}>전체</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'E1_prereport_draft' ? panel.filterTabActive : ''}`} onClick={() => setFilter('E1_prereport_draft')}>사전보고 작성</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'E2_prereport_review' ? panel.filterTabActive : ''}`} onClick={() => setFilter('E2_prereport_review')}>사전보고 검토</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'E4_execution' ? panel.filterTabActive : ''}`} onClick={() => setFilter('E4_execution')}>집행 중</button>
          </div>
        </div>
        <div className={panel.itemList}>
          {filtered.map((ex) => (
            <div key={ex.id} className={`${panel.item} ${selected?.id === ex.id ? panel.itemActive : ''}`} onClick={() => selectExecution(ex)}>
              <span className={panel.itemName}>{ex.projectTitle}</span>
              <span className={panel.itemMeta}>
                <span>{ex.clientName}</span>
                <span>·</span>
                <span className={`badge badge-sm badge-blue`}>{PROJECT_STATUS_META[ex.projectStatus]?.shortLabel ?? ex.projectStatus}</span>
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>집행 건이 없습니다.</div>
          )}
        </div>
        <div className={panel.leftFooter}>{filtered.length}건</div>
      </div>

      <div className={panel.rightPanel}>
        {!selected ? (
          <div className={panel.emptyState}><span className={panel.emptyIcon}><LuRocket size={32} /></span><span>집행 건을 선택하세요</span></div>
        ) : (
          <>
            <div className={panel.detailHeader}>
              <div>
                <div className={panel.detailTitle}>{selected.projectTitle}</div>
                <div className={panel.detailSubtitle}>{selected.clientName}</div>
              </div>
              <div className={panel.detailActions}>
                {(selected.projectStatus === 'E1_prereport_draft' || selected.projectStatus === 'E2_prereport_review') && (
                  <ActionButton label="사전보고서 작성" variant="primary" size="sm" onClick={() => alert('사전 보고서 작성 (TODO)')} />
                )}
              </div>
            </div>
            <div className="card">
              <div className={panel.detailGrid}>
                <div className={panel.detailField}><span className={panel.fieldLabel}>상태</span><span className={panel.fieldValue}><span className="badge badge-sm badge-blue">{PROJECT_STATUS_META[selected.projectStatus]?.shortLabel ?? '-'}</span></span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>서비스 유형</span><span className={panel.fieldValue}>{SERVICE_TYPE_META[selected.serviceType]?.label ?? '-'}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>예산</span><span className={panel.fieldValue}>{formatCurrency(selected.budget)}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>집행 기간</span><span className={panel.fieldValue}>{formatDate(selected.startDate)} ~ {formatDate(selected.endDate)}</span></div>
              </div>
            </div>
            <div className={panel.detailSection}>
              <div className={panel.detailSectionTitle}>집행 상세</div>
              <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                광고/바이럴 집행 내역이 여기에 표시됩니다.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}