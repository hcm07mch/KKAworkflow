'use client';

import { useState } from 'react';
import { LuRocket } from 'react-icons/lu';
import { ActionButton } from '@/components/ui';
import { SERVICE_TYPE_META } from '@/lib/domain/types';
import type { ServiceType } from '@/lib/domain/types';
import panel from '../panel-layout.module.css';

// ── Mock Data ────────────────────────────────────────────

type ExecStatus = 'pre_report' | 'in_progress' | 'done' | 'renewing';
const EXEC_STATUS_META: Record<ExecStatus, { label: string; badge: string }> = {
  pre_report:  { label: '사전 보고서', badge: 'badge-yellow' },
  in_progress: { label: '집행 중',     badge: 'badge-blue' },
  done:        { label: '완료',        badge: 'badge-green' },
  renewing:    { label: '갱신 검토',   badge: 'badge-orange' },
};

interface ExecItem {
  id: string;
  projectTitle: string;
  clientName: string;
  serviceType: ServiceType;
  status: ExecStatus;
  preReportDate: string | null;
  execStartDate: string | null;
  execEndDate: string | null;
  budget: number;
  spent: number;
}

const MOCK_EXECUTIONS: ExecItem[] = [
  { id: 'ex1', projectTitle: '블루오션 3월 마케팅 대행', clientName: '(주)블루오션 마케팅', serviceType: 'viral_performance', status: 'in_progress', preReportDate: '2026-03-14', execStartDate: '2026-03-15', execEndDate: '2026-05-31', budget: 3960000, spent: 1200000 },
  { id: 'ex2', projectTitle: '모어마케팅 블로그 대행', clientName: '모어마케팅', serviceType: 'performance', status: 'pre_report', preReportDate: null, execStartDate: '2026-04-01', execEndDate: '2026-06-30', budget: 3000000, spent: 0 },
  { id: 'ex3', projectTitle: '오렌지원 봄시즌 바이럴', clientName: '오렌지원', serviceType: 'viral', status: 'done', preReportDate: '2026-02-01', execStartDate: '2026-02-03', execEndDate: '2026-03-20', budget: 1800000, spent: 1800000 },
  { id: 'ex4', projectTitle: '블루오션 4월 월간 계약', clientName: '(주)블루오션 마케팅', serviceType: 'viral_performance', status: 'renewing', preReportDate: '2026-03-28', execStartDate: '2026-04-01', execEndDate: '2026-06-30', budget: 3960000, spent: 0 },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
}
function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Page ─────────────────────────────────────────────────

export default function ExecutionsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ExecStatus | 'all'>('all');
  const [selected, setSelected] = useState<ExecItem | null>(null);

  const filtered = MOCK_EXECUTIONS.filter((ex) => {
    if (filter !== 'all' && ex.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return ex.projectTitle.toLowerCase().includes(q) || ex.clientName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className={panel.wrapper}>
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <div className={panel.leftActions}>
            <span className={panel.leftTitle}>집행 관리</span>
          </div>
          <input className={panel.searchInput} placeholder="프로젝트, 고객사 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className={panel.filterTabs}>
            <button type="button" className={`${panel.filterTab} ${filter === 'all' ? panel.filterTabActive : ''}`} onClick={() => setFilter('all')}>전체</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'pre_report' ? panel.filterTabActive : ''}`} onClick={() => setFilter('pre_report')}>사전 보고서</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'in_progress' ? panel.filterTabActive : ''}`} onClick={() => setFilter('in_progress')}>집행 중</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'renewing' ? panel.filterTabActive : ''}`} onClick={() => setFilter('renewing')}>갱신 검토</button>
            <button type="button" className={`${panel.filterTab} ${filter === 'done' ? panel.filterTabActive : ''}`} onClick={() => setFilter('done')}>완료</button>
          </div>
        </div>
        <div className={panel.itemList}>
          {filtered.map((ex) => (
            <div key={ex.id} className={`${panel.item} ${selected?.id === ex.id ? panel.itemActive : ''}`} onClick={() => setSelected(ex)}>
              <span className={panel.itemName}>{ex.projectTitle}</span>
              <span className={panel.itemMeta}>
                <span>{ex.clientName}</span>
                <span>·</span>
                <span className={`badge badge-sm ${EXEC_STATUS_META[ex.status].badge}`}>{EXEC_STATUS_META[ex.status].label}</span>
              </span>
            </div>
          ))}
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
                {selected.status === 'pre_report' && <ActionButton label="보고서 작성" variant="primary" size="sm" onClick={() => alert('사전 보고서 작성 (TODO)')} />}
                {selected.status === 'renewing' && <ActionButton label="갱신 처리" variant="primary" size="sm" onClick={() => alert('갱신 처리 (TODO)')} />}
              </div>
            </div>
            <div className="card">
              <div className={panel.detailGrid}>
                <div className={panel.detailField}><span className={panel.fieldLabel}>상태</span><span className={panel.fieldValue}><span className={`badge badge-sm ${EXEC_STATUS_META[selected.status].badge}`}>{EXEC_STATUS_META[selected.status].label}</span></span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>서비스 유형</span><span className={panel.fieldValue}>{SERVICE_TYPE_META[selected.serviceType].label}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>예산</span><span className={panel.fieldValue}>{formatCurrency(selected.budget)}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>집행액</span><span className={panel.fieldValue}>{formatCurrency(selected.spent)}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>사전 보고일</span><span className={panel.fieldValue}>{formatDate(selected.preReportDate)}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>집행 기간</span><span className={panel.fieldValue}>{formatDate(selected.execStartDate)} ~ {formatDate(selected.execEndDate)}</span></div>
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
