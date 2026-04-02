'use client';

import { useEffect, useState } from 'react';
import { LuBuilding2, LuLoader, LuPlus } from 'react-icons/lu';
import { ActionButton } from '@/components/ui';
import { SERVICE_TYPE_META, PAYMENT_TYPE_META, CLIENT_TIER_META } from '@/lib/domain/types';
import type { ServiceType, PaymentType, ClientTier } from '@/lib/domain/types';
import panel from '../panel-layout.module.css';

// ── Types ────────────────────────────────────────────────

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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Page ─────────────────────────────────────────────────

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClientItem | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/clients').then((r) => r.json()),
      fetch('/api/projects?limit=500').then((r) => r.json()),
    ]).then(([clientsData, projectsRes]) => {
      const projectCounts = new Map<string, number>();
      for (const p of projectsRes.data ?? []) {
        projectCounts.set(p.client_id, (projectCounts.get(p.client_id) ?? 0) + 1);
      }
      const items: ClientItem[] = (clientsData ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        contactName: c.contact_name,
        contactEmail: c.contact_email,
        contactPhone: c.contact_phone,
        address: c.address,
        serviceType: c.service_type,
        paymentType: c.payment_type,
        tier: c.tier,
        projectCount: projectCounts.get(c.id) ?? 0,
        isActive: c.is_active,
        createdAt: c.created_at,
      }));
      setClients(items);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = clients.filter((c) => {
    if (!showInactive && !c.isActive) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.contactName?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  if (loading) {
    return (
      <div className={panel.wrapper}>
        <div className={panel.leftPanel}>
          <div className={panel.leftHeader}>
            <span className={panel.leftTitle}>고객 관리</span>
            <div className={panel.searchInput} style={{ opacity: 0.5 }} />
          </div>
          <div className={panel.itemList}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={panel.skeletonItem}>
                <div className={panel.skeletonBar} style={{ width: '60%' }} />
                <div className={panel.skeletonBar} style={{ width: '40%', height: 8 }} />
              </div>
            ))}
          </div>
        </div>
        <div className={panel.rightPanel}>
          <div className={panel.emptyState}>
            <span className={panel.emptyIcon}><LuBuilding2 size={32} /></span>
            <span>고객사를 선택하세요</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={panel.wrapper}>
      {/* ── Left Panel ── */}
      <div className={panel.leftPanel}>
        <div className={panel.leftHeader}>
          <span className={panel.leftTitle}>고객 관리</span>
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
          <div className={panel.addItem} onClick={() => alert('새 고객사 등록 (TODO)')}>
            <LuPlus size={14} /> 새 고객사
          </div>
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`${panel.item} ${selected?.id === c.id ? panel.itemActive : ''}`}
              onClick={() => setSelected(c)}
            >
              <span className={panel.itemName}>{c.name}</span>
              <span className={panel.itemMeta}>
                <span>{SERVICE_TYPE_META[c.serviceType]?.label ?? '-'}</span>
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
                  {CLIENT_TIER_META[selected.tier]?.label ?? '-'} · {selected.isActive ? '활성' : '비활성'}
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
                  <span className={panel.fieldValue}>{SERVICE_TYPE_META[selected.serviceType]?.label ?? '-'}</span>
                </div>
                <div className={panel.detailField}>
                  <span className={panel.fieldLabel}>결제 방식</span>
                  <span className={panel.fieldValue}>{PAYMENT_TYPE_META[selected.paymentType]?.label ?? '-'}</span>
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