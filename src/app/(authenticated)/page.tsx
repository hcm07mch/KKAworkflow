'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ProjectStatus } from '@/lib/domain/types';
import { PROJECT_STATUS_META, PROJECT_STATUS_GROUPS } from '@/lib/domain/types';
import {
  LuArrowRight,
  LuClock,
  LuExternalLink,
  LuInfo,
} from 'react-icons/lu';
import styles from './dashboard.module.css';

// == Types ====================================================================

interface PipelineProject {
  id: string;
  client: string;
  title: string;
  status: ProjectStatus;
  owner: string | null;
}

interface DashboardData {
  pipeline: PipelineProject[];
  estimateStats: {
    pending: number; approved: number; rejected: number; total: number;
    approveRate: number; rejectRate: number;
  };
  unpaid: {
    count: number; totalAmount: number;
    items: { client: string; project: string; amount: number; daysOverdue: number }[];
  };
  executionQueue: {
    count: number;
    items: { client: string; project: string; daysWaiting: number }[];
  };
  renewal: {
    total: number; renewed: number; cancelled: number; pending: number; renewRate: number;
  };
}

function fmt(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n);
}

/* -- pipeline dot-map color helper -- */
const DOT_COLORS: Record<string, string> = {
  gray: '#9ca3af', blue: '#3b82f6', yellow: '#f59e0b', indigo: '#6366f1',
  cyan: '#06b6d4', emerald: '#10b981', orange: '#f97316', green: '#22c55e', red: '#ef4444',
};

function PipelineDotMap({ projects }: { projects: PipelineProject[] }) {
  const grouped = PROJECT_STATUS_GROUPS
    .filter((g) => g.key !== 'F' && g.key !== 'G')
    .map((group) => {
      const items = projects.filter((p) => group.statuses.includes(p.status));
      return { ...group, items };
    });

  return (
    <div className={styles.dotGrid}>
      {grouped.map((group) => (
        <div key={group.key} className={styles.dotCell}>
          <div className={styles.dotCellHeader}>
            <span className={styles.dotCellKey}>{group.key}</span>
            <span className={styles.dotCellLabel}>{group.label}</span>
            <span className={styles.dotCellCount}>{group.items.length}</span>
          </div>
          <div className={styles.dotCellBody}>
            {group.items.length === 0 && (
              <span className={styles.dotCellEmpty}>—</span>
            )}
            {group.items.map((p) => {
              const meta = PROJECT_STATUS_META[p.status];
              const bg = DOT_COLORS[meta.color] ?? DOT_COLORS.gray;
              return (
                <span key={p.id} className={styles.dotWrap}>
                  <span
                    className={styles.dot}
                    style={{ background: bg }}
                  />
                  <span className={styles.dotTooltip}>
                    <span className={styles.dotTooltipClient}>{p.client}</span>
                    <span className={styles.dotTooltipTitleRow}>
                      <span className={styles.dotTooltipTitle}>{p.title}</span>
                      <Link href={`/projects?selected=${p.id}`} className={styles.dotTooltipIconLink} title="프로젝트 보기">
                        <LuExternalLink size={12} />
                      </Link>
                    </span>
                    <span className={styles.dotTooltipStatus}>
                      <span className={styles.dotTooltipStatusDot} style={{ background: bg }} />
                      {meta.shortLabel}
                    </span>
                    {p.owner && (
                      <span className={styles.dotTooltipAssignee}>
                        담당: {p.owner}
                      </span>
                    )}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data || !data.pipeline) {
    return (
      <div className="page-container">
        {/* Header skeleton */}
        <div className={styles.pageHeader}>
          <div className="skeleton skeleton-line-lg" style={{ width: 120 }} />
          <div className="skeleton skeleton-line-sm" style={{ width: 160 }} />
        </div>
        {/* Stat strip skeleton */}
        <div className={styles.statStrip}>
          {[1,2,3,4].map((i) => (
            <React.Fragment key={i}>
              {i > 1 && <div className={styles.statDivider} />}
              <div className={styles.statItem}>
                <div className="skeleton skeleton-line-sm" style={{ width: 60 }} />
                <div className="skeleton skeleton-line-lg" style={{ width: 48, height: 28 }} />
                <div className="skeleton skeleton-line-sm" style={{ width: 80 }} />
              </div>
            </React.Fragment>
          ))}
        </div>
        {/* Pipeline skeleton */}
        <div className="skeleton skeleton-block-lg" style={{ width: '100%' }} />
        {/* Two-col skeleton */}
        <div className={styles.twoCol}>
          <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="skeleton" style={{ height: 80, borderRadius: 8 }} />
            <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
          </div>
        </div>
      </div>
    );
  }

  const { pipeline, estimateStats, unpaid, executionQueue, renewal } = data;
  const pipelineTotal = pipeline.length;

  return (
    <div className="page-container">
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Overview</h1>
        <span className={styles.pageDate}>
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* -- 핵심 수치 (inline stat strip) -- */}
      <div className={styles.statStrip}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>견적 승인율</span>
          <span className={styles.statValue}>{estimateStats.approveRate}%</span>
          <span className={styles.statSub}>승인 {estimateStats.approved} · 거절 {estimateStats.rejected}</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statLabel}>미입금</span>
          <span className={`${styles.statValue} ${styles.statWarn}`}>{unpaid.count}건</span>
          <span className={styles.statSub}>₩{fmt(unpaid.totalAmount)}</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statLabel}>집행 대기</span>
          <span className={styles.statValue}>{executionQueue.count}건</span>
          <span className={styles.statSub}>입금 후 미집행</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statLabel}>계약 갱신율</span>
          <span className={styles.statValue}>{renewal.renewRate}%</span>
          <span className={styles.statSub}>갱신 {renewal.renewed} · 해지 {renewal.cancelled}</span>
        </div>
      </div>

      {/* -- 파이프라인 현황 -- */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>프로젝트 현황</h2>
          <span className={styles.legendHelpWrap}>
            <LuInfo size={14} className={styles.legendHelpIcon} />
            <span className={styles.legendHelpTooltip}>
              <span className={styles.legendHelpTitle}>닷 컬러 가이드</span>
              <span className={styles.legendRow}><span className={styles.legendSwatch} style={{ background: '#3b82f6' }} />작성 단계</span>
              <span className={styles.legendRow}><span className={styles.legendSwatch} style={{ background: '#f59e0b' }} />승인 단계</span>
              <span className={styles.legendRow}><span className={styles.legendSwatch} style={{ background: '#6366f1' }} />전달 단계</span>
              <span className={styles.legendRow}><span className={styles.legendSwatch} style={{ background: '#06b6d4' }} />응답 단계</span>
              <span className={styles.legendRow}><span className={styles.legendSwatch} style={{ background: '#10b981' }} />확인/체결</span>
              <span className={styles.legendRow}><span className={styles.legendSwatch} style={{ background: '#f97316' }} />대기</span>
              <span className={styles.legendRow}><span className={styles.legendSwatch} style={{ background: '#22c55e' }} />집행</span>
              <span className={styles.legendRow}><span className={styles.legendSwatch} style={{ background: '#9ca3af' }} />영업/종료</span>
              <span className={styles.legendRow}><span className={styles.legendSwatch} style={{ background: '#ef4444' }} />환불</span>
            </span>
          </span>
          <span className={styles.sectionSub}>전체 {pipelineTotal}건</span>
          <Link href="/projects" className={styles.sectionLink}>프로젝트 목록 <LuArrowRight size={12} /></Link>
        </div>
        <div className={`card ${styles.pipelineCard}`}>
          <PipelineDotMap projects={pipeline} />
        </div>
      </section>

      {/* -- 미입금 테이블 + 오른쪽 스택 -- */}
      <div className={styles.twoCol}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              미입금 목록
            </h2>
            <Link href="/payments" className={styles.sectionLink}>전체보기 <LuArrowRight size={12} /></Link>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>고객</th><th>프로젝트</th>
                  <th className={styles.alignRight}>금액</th>
                  <th className={styles.alignRight}>경과</th>
                </tr>
              </thead>
              <tbody>
                {unpaid.items.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>미입금 건 없음</td></tr>
                )}
                {unpaid.items.map((row, i) => (
                  <tr key={i}>
                    <td className={styles.cellBold}>{row.client}</td>
                    <td>{row.project}</td>
                    <td className={styles.alignRight}>₩{fmt(row.amount)}</td>
                    <td className={`${styles.alignRight} ${row.daysOverdue >= 7 ? styles.cellDanger : styles.cellWarn}`}>
                      {row.daysOverdue}일
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className={styles.rightStack}>
          {/* 집행 대기 */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                집행 대기
              </h2>
              <Link href="/executions" className={styles.sectionLink}>전체보기 <LuArrowRight size={12} /></Link>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {executionQueue.items.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>대기 중인 건 없음</div>
              )}
              {executionQueue.items.map((row, i) => (
                <div key={i} className={styles.queueRow}>
                  <div className={styles.queueInfo}>
                    <span className={styles.queueClient}>{row.client}</span>
                    <span className={styles.queueProject}>{row.project}</span>
                  </div>
                  <div className={styles.queueRight}>
                    <LuClock size={12} /><span>{row.daysWaiting}일 대기</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}