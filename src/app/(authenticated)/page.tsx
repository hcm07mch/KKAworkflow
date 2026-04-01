'use client';

import Link from 'next/link';
import { StatusBadge } from '@/components/ui';
import type { ProjectStatus, DocumentStatus, ServiceType } from '@/lib/domain/types';
import { PROJECT_STATUS_META, DOCUMENT_STATUS_META, SERVICE_TYPE_META } from '@/lib/domain/types';
import {
  LuWallet,
  LuTrendingUp,
  LuUsers,
  LuBell,
  LuClipboardList,
  LuMessageSquare,
} from 'react-icons/lu';
import styles from './dashboard.module.css';

// ── Mock 대시보드 데이터 ──────────────────────────────────

const KPI = {
  totalRevenue: 2_450_000_000,
  totalRevenueGrowth: '+12.5%',
  totalRevenueGrowthAmount: 270_000_000,
  monthRevenue: 185_000_000,
  monthRevenueGrowth: '+8.3%',
  monthRevenueGrowthAmount: 15_000_000,
  newClients: 23,
  newClientsGrowth: '+15.2%',
  newClientsGrowthCount: 3,
  alerts: 8,
  unreadAlerts: 8,
};

const MONTHLY_REVENUE = [
  { month: '1월', value: 120 },
  { month: '2월', value: 145 },
  { month: '3월', value: 185 },
  { month: '4월', value: 160 },
  { month: '5월', value: 195 },
  { month: '6월', value: 210 },
];

const INVENTORY_STATUS = {
  normal: { count: 118, pct: 75.6, color: 'var(--color-primary)' },
  low: { count: 32, pct: 20.5, color: '#f59e0b' },
  empty: { count: 6, pct: 3.9, color: 'var(--color-secondary)' },
  total: 156,
};

const RECENT_ESTIMATES: {
  title: string;
  description: string;
  amount: number;
  timeAgo: string;
}[] = [
  { title: '대한전자 견적서', description: '반도체 부품 견적', amount: 15_000_000, timeAgo: '2시간 전' },
  { title: '현대중공업 견적서', description: '조선 장비 부품 견적', amount: 8_500_000, timeAgo: '5시간 전' },
];

const RECENT_CONTRACTS: {
  title: string;
  description: string;
  amount: number;
  timeAgo: string;
}[] = [
  { title: '삼성전자 계약서', description: '연간 부품 공급 계약', amount: 120_000_000, timeAgo: '1일 전' },
  { title: 'LG화학 계약서', description: '화학 부품 납품 계약', amount: 45_000_000, timeAgo: '3일 전' },
];

const CUSTOMER_INQUIRIES: {
  title: string;
  description: string;
  timeAgo: string;
  priority: 'urgent' | 'normal';
}[] = [
  { title: 'SK하이닉스 문의', description: '메모리 부품 가격 문의', timeAgo: '30분 전', priority: 'urgent' },
  { title: '포스코 문의', description: '철강 부품 납기 일정 문의', timeAgo: '2시간 전', priority: 'normal' },
];

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

// ── Simple Bar Chart (CSS) ──

function MiniBarChart({ data }: { data: { month: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className={styles.barChart}>
      {data.map((d) => (
        <div key={d.month} className={styles.barCol}>
          <div className={styles.barTrack}>
            <div
              className={styles.bar}
              style={{ height: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span className={styles.barLabel}>{d.month}</span>
        </div>
      ))}
    </div>
  );
}

// ── Simple Donut (SVG) ──

function DonutChart() {
  const { normal, low, empty, total } = INVENTORY_STATUS;
  const r = 54;
  const c = 2 * Math.PI * r;
  const normalLen = (normal.pct / 100) * c;
  const lowLen = (low.pct / 100) * c;
  const emptyLen = (empty.pct / 100) * c;

  return (
    <div className={styles.donutWrapper}>
      <div className={styles.donutLegend}>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: normal.color }} />
          정상 {normal.count}개 ({normal.pct}%)
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: low.color }} />
          부족 {low.count}개 ({low.pct}%)
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: empty.color }} />
          없음 {empty.count}개 ({empty.pct}%)
        </div>
      </div>
      <div className={styles.donutSvgWrap}>
        <svg viewBox="0 0 128 128" className={styles.donutSvg}>
          {/* Normal */}
          <circle cx="64" cy="64" r={r} fill="none" strokeWidth="16"
            stroke={normal.color}
            strokeDasharray={`${normalLen} ${c - normalLen}`}
            strokeDashoffset="0"
            transform="rotate(-90 64 64)"
          />
          {/* Low */}
          <circle cx="64" cy="64" r={r} fill="none" strokeWidth="16"
            stroke={low.color}
            strokeDasharray={`${lowLen} ${c - lowLen}`}
            strokeDashoffset={`${-normalLen}`}
            transform="rotate(-90 64 64)"
          />
          {/* Empty */}
          <circle cx="64" cy="64" r={r} fill="none" strokeWidth="16"
            stroke={empty.color}
            strokeDasharray={`${emptyLen} ${c - emptyLen}`}
            strokeDashoffset={`${-(normalLen + lowLen)}`}
            transform="rotate(-90 64 64)"
          />
        </svg>
        <div className={styles.donutCenter}>
          <span className={styles.donutTotal}>{total}</span>
          <span className={styles.donutLabel}>총 품목</span>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <div className="page-container">
      <h1 className={styles.pageTitle}>Overview</h1>

      {/* ── KPI Cards ── */}
      <div className={styles.kpiRow}>
        {/* 전체 매출 — highlighted */}
        <div className={`${styles.kpiCard} ${styles.kpiHighlight}`}>
          <div className={styles.kpiHeader}>
            <LuWallet size={16} />
            <span>전체 매출</span>
          </div>
          <p className={styles.kpiValue}>₩{formatCurrency(KPI.totalRevenue)}</p>
          <p className={styles.kpiSub}>
            전년 대비 ₩{formatCurrency(KPI.totalRevenueGrowthAmount)} 상승 ({KPI.totalRevenueGrowth})
          </p>
        </div>

        {/* 이번 달 매출 */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <LuTrendingUp size={16} />
            <span>이번 달 매출</span>
          </div>
          <p className={styles.kpiValue}>₩{formatCurrency(KPI.monthRevenue)}</p>
          <p className={styles.kpiSub}>
            전월 대비 ₩{formatCurrency(KPI.monthRevenueGrowthAmount)} 상승 ({KPI.monthRevenueGrowth})
          </p>
        </div>

        {/* 신규 고객 수 */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <LuUsers size={16} />
            <span>신규 고객 수</span>
          </div>
          <p className={styles.kpiValue}>{KPI.newClients}명</p>
          <p className={styles.kpiSub}>
            전월 대비 {KPI.newClientsGrowthCount}명 증가 ({KPI.newClientsGrowth})
          </p>
        </div>

        {/* 알림 */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <LuBell size={16} />
            <span>알림</span>
            <Link href="/settings" className={styles.detailLink}>자세히보기</Link>
          </div>
          <p className={styles.kpiValue}>{KPI.alerts}개</p>
          <p className={styles.kpiSub}>읽지 않은 알림</p>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className={styles.chartsRow}>
        {/* 월별 매출 추이 */}
        <div className={`card ${styles.chartCard}`}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitleArea}>
              <h2 className="section-title">월별 매출 추이</h2>
              <Link href="/projects" className={styles.detailLink}>자세히보기</Link>
            </div>
            <select className={styles.chartSelect}>
              <option>최근 6개월</option>
              <option>최근 12개월</option>
            </select>
          </div>
          <MiniBarChart data={MONTHLY_REVENUE} />
        </div>

        {/* 고객 등록 추이 — placeholder */}
        <div className={`card ${styles.chartCard}`}>
          <div className={styles.chartHeader}>
            <h2 className="section-title">고객 등록 추이</h2>
            <Link href="/clients" className={styles.detailLink}>자세히보기</Link>
          </div>
          <div className={styles.chartPlaceholder}>
            <svg viewBox="0 0 300 120" className={styles.lineChartSvg}>
              <polyline
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2.5"
                points="10,100 60,85 110,70 160,50 210,35 260,20 290,15"
              />
              <polyline
                fill="rgba(19,38,78,0.08)"
                stroke="none"
                points="10,120 10,100 60,85 110,70 160,50 210,35 260,20 290,15 290,120"
              />
            </svg>
          </div>
        </div>

        {/* 재고 현황 — donut */}
        <div className={`card ${styles.chartCard}`}>
          <div className={styles.chartHeader}>
            <h2 className="section-title">재고 현황</h2>
            <Link href="/settings" className={styles.detailLink}>자세히보기</Link>
          </div>
          <DonutChart />
        </div>
      </div>

      {/* ── Bottom Lists Row ── */}
      <div className={styles.listsRow}>
        {/* 최근 견적서 */}
        <div className={`card ${styles.listCard}`}>
          <div className={styles.listHeader}>
            <h2 className="section-title"><LuClipboardList style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} /> 최근 견적서</h2>
            <Link href="/projects" className={styles.detailLink}>더보기</Link>
          </div>
          {RECENT_ESTIMATES.map((item, i) => (
            <div key={i} className={styles.listItem}>
              <div className={styles.listItemInfo}>
                <span className={styles.listItemTitle}>{item.title}</span>
                <span className={styles.listItemDesc}>{item.description}</span>
                <span className={styles.listItemTime}>{item.timeAgo}</span>
              </div>
              <span className={styles.listItemAmount}>₩{formatCurrency(item.amount)}</span>
            </div>
          ))}
        </div>

        {/* 최근 계약서 */}
        <div className={`card ${styles.listCard}`}>
          <div className={styles.listHeader}>
            <h2 className="section-title"><LuClipboardList style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} /> 최근 계약서</h2>
            <Link href="/projects" className={styles.detailLink}>더보기</Link>
          </div>
          {RECENT_CONTRACTS.map((item, i) => (
            <div key={i} className={styles.listItem}>
              <div className={styles.listItemInfo}>
                <span className={styles.listItemTitle}>{item.title}</span>
                <span className={styles.listItemDesc}>{item.description}</span>
                <span className={styles.listItemTime}>{item.timeAgo}</span>
              </div>
              <span className={styles.listItemAmount}>₩{formatCurrency(item.amount)}</span>
            </div>
          ))}
        </div>

        {/* 고객 문의 */}
        <div className={`card ${styles.listCard}`}>
          <div className={styles.listHeader}>
            <h2 className="section-title"><LuMessageSquare style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} /> 고객 문의</h2>
            <Link href="/clients" className={styles.detailLink}>더보기</Link>
          </div>
          {CUSTOMER_INQUIRIES.map((item, i) => (
            <div key={i} className={styles.listItem}>
              <div className={styles.listItemInfo}>
                <span className={styles.listItemTitle}>{item.title}</span>
                <span className={styles.listItemDesc}>{item.description}</span>
                <span className={styles.listItemTime}>{item.timeAgo}</span>
              </div>
              <span className={`${styles.priorityBadge} ${item.priority === 'urgent' ? styles.priorityUrgent : styles.priorityNormal}`}>
                {item.priority === 'urgent' ? '긴급' : '일반'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
