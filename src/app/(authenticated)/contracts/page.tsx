'use client';

import { useState } from 'react';
import { LuFilePen } from 'react-icons/lu';
import { StatusBadge, ActionButton } from '@/components/ui';
import type { DocumentStatus, ServiceType } from '@/lib/domain/types';
import { SERVICE_TYPE_META } from '@/lib/domain/types';
import panel from '../panel-layout.module.css';

// ── Mock Data ────────────────────────────────────────────

interface ContractItem {
  id: string;
  code: string;
  projectTitle: string;
  clientName: string;
  serviceType: ServiceType;
  status: DocumentStatus;
  monthlyAmount: number;
  contractMonths: number;
  startDate: string | null;
  createdAt: string;
}

const MOCK_CONTRACTS: ContractItem[] = [
  { id: 'ct1', code: 'CTR-2026-001', projectTitle: '블루오션 3월 마케팅 대행', clientName: '(주)블루오션 마케팅', serviceType: 'viral_performance', status: 'approved', monthlyAmount: 3960000, contractMonths: 3, startDate: '2026-03-15', createdAt: '2026-03-12' },
  { id: 'ct2', code: 'CTR-2026-002', projectTitle: '그린텍 브랜드 프로젝트', clientName: '그린텍', serviceType: 'performance', status: 'sent', monthlyAmount: 5500000, contractMonths: 3, startDate: '2026-04-01', createdAt: '2026-03-18' },
  { id: 'ct3', code: 'CTR-2026-003', projectTitle: '모어마케팅 블로그 대행', clientName: '모어마케팅', serviceType: 'performance', status: 'draft', monthlyAmount: 3000000, contractMonths: 3, startDate: null, createdAt: '2026-03-22' },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
}
function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Page ─────────────────────────────────────────────────

export default function ContractsPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ContractItem | null>(null);

  const filtered = MOCK_CONTRACTS.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      return c.projectTitle.toLowerCase().includes(q) || c.clientName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className={panel.wrapper}>
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <div className={panel.leftActions}>
            <span className={panel.leftTitle}>계약서</span>
            <ActionButton label="+ 작성" variant="primary" size="sm" onClick={() => alert('계약서 작성 (TODO)')} />
          </div>
          <input className={panel.searchInput} placeholder="프로젝트, 고객사 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className={panel.itemList}>
          {filtered.map((c) => (
            <div key={c.id} className={`${panel.item} ${selected?.id === c.id ? panel.itemActive : ''}`} onClick={() => setSelected(c)}>
              <span className={panel.itemName}>{c.clientName}</span>
              <span className={panel.itemMeta}>
                <span>{formatCurrency(c.monthlyAmount)}/월</span>
                <span>·</span>
                <StatusBadge status={c.status} type="document" />
              </span>
            </div>
          ))}
        </div>
        <div className={panel.leftFooter}>{filtered.length}건</div>
      </div>

      <div className={panel.rightPanel}>
        {!selected ? (
          <div className={panel.emptyState}><span className={panel.emptyIcon}><LuFilePen size={32} /></span><span>계약서를 선택하세요</span></div>
        ) : (
          <>
            <div className={panel.detailHeader}>
              <div>
                <div className={panel.detailTitle}>{selected.code}</div>
                <div className={panel.detailSubtitle}>{selected.projectTitle}</div>
              </div>
              <div className={panel.detailActions}>
                <ActionButton label="발송" variant="primary" size="sm" onClick={() => alert('발송 (TODO)')} />
                <ActionButton label="수정" variant="secondary" size="sm" onClick={() => alert('수정 (TODO)')} />
              </div>
            </div>
            <div className="card">
              <div className={panel.detailGrid}>
                <div className={panel.detailField}><span className={panel.fieldLabel}>고객사</span><span className={panel.fieldValue}>{selected.clientName}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>상태</span><span className={panel.fieldValue}><StatusBadge status={selected.status} type="document" /></span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>서비스 유형</span><span className={panel.fieldValue}>{SERVICE_TYPE_META[selected.serviceType].label}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>월 금액</span><span className={panel.fieldValue}>{formatCurrency(selected.monthlyAmount)}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>계약 기간</span><span className={panel.fieldValue}>{selected.contractMonths}개월</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>총 금액</span><span className={panel.fieldValue}>{formatCurrency(selected.monthlyAmount * selected.contractMonths)}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>시작일</span><span className={panel.fieldValue}>{formatDate(selected.startDate)}</span></div>
                <div className={panel.detailField}><span className={panel.fieldLabel}>작성일</span><span className={panel.fieldValue}>{formatDate(selected.createdAt)}</span></div>
              </div>
            </div>
            <div className={panel.detailSection}>
              <div className={panel.detailSectionTitle}>승인 이력</div>
              <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>승인/반려 이력이 여기에 표시됩니다.</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
