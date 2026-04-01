'use client';

import { useState } from 'react';
import { LuBuilding2 } from 'react-icons/lu';
import { ActionButton } from '@/components/ui';
import { SERVICE_TYPE_META, PAYMENT_TYPE_META, CLIENT_TIER_META } from '@/lib/domain/types';
import type { ServiceType, PaymentType, ClientTier } from '@/lib/domain/types';
import panel from '../panel-layout.module.css';

// ── Mock Data ────────────────────────────────────────────

interface ClientItem {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  serviceType: ServiceType;
  paymentType: PaymentType;
  tier: ClientTier;
  projectCount: number;
  isActive: boolean;
  createdAt: string;
}

const MOCK_CLIENTS: ClientItem[] = [
  { id: 'c1', name: '(주)블루오션 마케팅', contactName: '정하린', contactEmail: 'harin@blueocean.co.kr', contactPhone: '010-1234-5678', address: '서울특별시 강남구 테헤란로 152', serviceType: 'viral_performance', paymentType: 'deposit', tier: 'loyal', projectCount: 3, isActive: true, createdAt: '2026-01-15' },
  { id: 'c2', name: '그린텍', contactName: '최영호', contactEmail: 'yh@greentech.kr', contactPhone: '010-2345-6789', address: '서울특별시 서초구 서초대로 301', serviceType: 'performance', paymentType: 'per_invoice', tier: 'regular', projectCount: 1, isActive: true, createdAt: '2026-02-01' },
  { id: 'c3', name: '스카이미디어', contactName: '한지수', contactEmail: 'jisu@skymedia.co.kr', contactPhone: '010-3456-7890', address: '서울특별시 마포구 월드컵북로 396', serviceType: 'viral', paymentType: 'per_invoice', tier: 'regular', projectCount: 1, isActive: true, createdAt: '2026-02-15' },
  { id: 'c4', name: '하이브랜드', contactName: '오재민', contactEmail: 'jm@hibrand.co.kr', contactPhone: '010-4567-8901', address: '서울특별시 송파구 올림픽로 98', serviceType: 'viral_performance', paymentType: 'per_invoice', tier: 'regular', projectCount: 1, isActive: true, createdAt: '2026-03-01' },
  { id: 'c5', name: '오렌지원', contactName: '김미래', contactEmail: 'mirae@orange.kr', contactPhone: '010-5678-9012', address: '부산광역시 해운대구 해운대로 79', serviceType: 'viral', paymentType: 'per_invoice', tier: 'regular', projectCount: 1, isActive: true, createdAt: '2026-01-20' },
  { id: 'c6', name: '모어마케팅', contactName: '윤대건', contactEmail: 'dk@moremarketing.kr', contactPhone: '010-6789-0123', address: '서울특별시 영등포구 여의대로 115', serviceType: 'performance', paymentType: 'deposit', tier: 'loyal', projectCount: 1, isActive: true, createdAt: '2026-03-05' },
  { id: 'c7', name: '레드스타', contactName: '강하늘', contactEmail: 'sky@redstar.kr', contactPhone: '010-7890-1234', address: '서울특별시 용산구 한남대로 300', serviceType: 'viral', paymentType: 'per_invoice', tier: 'regular', projectCount: 1, isActive: false, createdAt: '2026-02-10' },
  { id: 'c8', name: '실버라인', contactName: '서인우', contactEmail: 'sw@silverline.kr', contactPhone: '010-8901-2345', address: '인천광역시 남동구 컨벤시아대로 165', serviceType: 'viral_performance', paymentType: 'per_invoice', tier: 'regular', projectCount: 1, isActive: false, createdAt: '2026-01-25' },
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Page ─────────────────────────────────────────────────

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClientItem | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const filtered = MOCK_CLIENTS.filter((c) => {
    if (!showInactive && !c.isActive) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.contactName?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  return (
    <div className={panel.wrapper}>
      {/* ── Left Panel ── */}
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <div className={panel.leftActions}>
            <span className={panel.leftTitle}>고객 관리</span>
            <ActionButton label="+ 추가" variant="primary" size="sm" onClick={() => alert('새 고객사 등록 (TODO)')} />
          </div>
          <input
            className={panel.searchInput}
            placeholder="고객사명, 담당자 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={panel.filterTabs}>
            <button
              type="button"
              className={`${panel.filterTab} ${!showInactive ? panel.filterTabActive : ''}`}
              onClick={() => setShowInactive(false)}
            >활성</button>
            <button
              type="button"
              className={`${panel.filterTab} ${showInactive ? panel.filterTabActive : ''}`}
              onClick={() => setShowInactive(true)}
            >전체</button>
          </div>
        </div>

        <div className={panel.itemList}>
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`${panel.item} ${selected?.id === c.id ? panel.itemActive : ''}`}
              onClick={() => setSelected(c)}
            >
              <span className={panel.itemName}>{c.name}</span>
              <span className={panel.itemMeta}>
                <span>{SERVICE_TYPE_META[c.serviceType].label}</span>
                <span>·</span>
                <span>{c.projectCount}건</span>
                {!c.isActive && <span className={`badge badge-sm badge-slate ${panel.itemBadge}`}>비활성</span>}
              </span>
            </div>
          ))}
        </div>

        <div className={panel.leftFooter}>{filtered.length}개 고객사</div>
      </div>

      {/* ── Right Panel ── */}
      <div className={panel.rightPanel}>
        {!selected ? (
          <div className={panel.emptyState}>
            <span className={panel.emptyIcon}><LuBuilding2 size={32} /></span>
            <span>고객사를 선택하세요</span>
          </div>
        ) : (
          <>
            <div className={panel.detailHeader}>
              <div>
                <div className={panel.detailTitle}>{selected.name}</div>
                <div className={panel.detailSubtitle}>
                  {CLIENT_TIER_META[selected.tier].label} · {selected.isActive ? '활성' : '비활성'}
                </div>
              </div>
              <div className={panel.detailActions}>
                <ActionButton label="수정" variant="secondary" size="sm" onClick={() => alert('수정 (TODO)')} />
                <ActionButton
                  label={selected.isActive ? '비활성화' : '활성화'}
                  variant={selected.isActive ? 'danger' : 'primary'}
                  size="sm"
                  onClick={() => alert('상태 변경 (TODO)')}
                />
              </div>
            </div>

            <div className="card">
              <div className={panel.detailGrid}>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>담당자</span>
                  <span className={panel.fieldValue}>{selected.contactName ?? '-'}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>이메일</span>
                  <span className={panel.fieldValue}>{selected.contactEmail ?? '-'}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>연락처</span>
                  <span className={panel.fieldValue}>{selected.contactPhone ?? '-'}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>프로젝트 수</span>
                  <span className={panel.fieldValue}>{selected.projectCount}건</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>서비스 유형</span>
                  <span className={panel.fieldValue}>{SERVICE_TYPE_META[selected.serviceType].label}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>결제 방식</span>
                  <span className={panel.fieldValue}>{PAYMENT_TYPE_META[selected.paymentType].label}</span>
                </div>
                <div className={`${panel.detailField} ${panel.detailFieldFull}`}>
                  <span className={panel.fieldLabel}>주소</span>
                  <span className={panel.fieldValue}>{selected.address ?? '-'}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>등록일</span>
                  <span className={panel.fieldValue}>{formatDate(selected.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className={panel.detailSection}>
              <div className={panel.detailSectionTitle}>프로젝트 이력</div>
              <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                이 고객의 프로젝트가 여기에 표시됩니다.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
