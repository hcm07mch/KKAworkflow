'use client';

import { useState } from 'react';
import { ActionButton } from '@/components/ui';
import { SERVICE_TYPE_META, PAYMENT_TYPE_META, CLIENT_TIER_META } from '@/lib/domain/types';
import type { ServiceType, PaymentType, ClientTier } from '@/lib/domain/types';

// ── Mock 고객사 데이터 ───────────────────────────────────

interface ClientListItem {
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

const MOCK_CLIENTS: ClientListItem[] = [
  {
    id: 'c1', name: '(주)블루오션 마케팅', contactName: '정하린',
    contactEmail: 'harin@blueocean.co.kr', contactPhone: '010-1234-5678',
    address: '서울특별시 강남구 테헤란로 152', serviceType: 'viral_performance', paymentType: 'deposit', tier: 'loyal',
    projectCount: 3, isActive: true, createdAt: '2026-01-15',
  },
  {
    id: 'c2', name: '그린텍', contactName: '최영호',
    contactEmail: 'yh@greentech.kr', contactPhone: '010-2345-6789',
    address: '서울특별시 서초구 서초대로 301', serviceType: 'performance', paymentType: 'per_invoice', tier: 'regular',
    projectCount: 1, isActive: true, createdAt: '2026-02-01',
  },
  {
    id: 'c3', name: '스카이미디어', contactName: '한지수',
    contactEmail: 'jisu@skymedia.co.kr', contactPhone: '010-3456-7890',
    address: '서울특별시 마포구 월드컵북로 396', serviceType: 'viral', paymentType: 'per_invoice', tier: 'regular',
    projectCount: 1, isActive: true, createdAt: '2026-02-15',
  },
  {
    id: 'c4', name: '하이브랜드', contactName: '오재민',
    contactEmail: 'jm@hibrand.co.kr', contactPhone: '010-4567-8901',
    address: '서울특별시 송파구 올림픽로 98', serviceType: 'viral_performance', paymentType: 'per_invoice', tier: 'regular',
    projectCount: 1, isActive: true, createdAt: '2026-03-01',
  },
  {
    id: 'c5', name: '오렌지원', contactName: '김미래',
    contactEmail: 'mirae@orange.kr', contactPhone: '010-5678-9012',
    address: '부산광역시 해운대구 해운대로 79', serviceType: 'viral', paymentType: 'per_invoice', tier: 'regular',
    projectCount: 1, isActive: true, createdAt: '2026-01-20',
  },
  {
    id: 'c6', name: '모어마케팅', contactName: '윤대건',
    contactEmail: 'dk@moremarketing.kr', contactPhone: '010-6789-0123',
    address: '서울특별시 영등포구 여의대로 115', serviceType: 'performance', paymentType: 'deposit', tier: 'loyal',
    projectCount: 1, isActive: true, createdAt: '2026-03-05',
  },
  {
    id: 'c7', name: '레드스타', contactName: '강하늘',
    contactEmail: 'sky@redstar.kr', contactPhone: '010-7890-1234',
    address: '서울특별시 용산구 한남대로 300', serviceType: 'viral', paymentType: 'per_invoice', tier: 'regular',
    projectCount: 1, isActive: false, createdAt: '2026-02-10',
  },
  {
    id: 'c8', name: '실버라인', contactName: '서인우',
    contactEmail: 'sw@silverline.kr', contactPhone: '010-8901-2345',
    address: '인천광역시 남동구 컨벤시아대로 165', serviceType: 'viral_performance', paymentType: 'per_invoice', tier: 'regular',
    projectCount: 1, isActive: false, createdAt: '2026-01-25',
  },
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── 고객사 상세 패널 ─────────────────────────────────────

function ClientDetailPanel({ client, onClose }: { client: ClientListItem; onClose: () => void }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">{client.name}</h2>
        <ActionButton label="닫기" variant="ghost" onClick={onClose} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-gray-400 mb-0.5">담당자</dt>
          <dd className="font-medium text-gray-800">{client.contactName ?? '-'}</dd>
        </div>
        <div>
          <dt className="text-gray-400 mb-0.5">이메일</dt>
          <dd className="font-medium text-gray-800">{client.contactEmail ?? '-'}</dd>
        </div>
        <div>
          <dt className="text-gray-400 mb-0.5">연락처</dt>
          <dd className="font-medium text-gray-800">{client.contactPhone ?? '-'}</dd>
        </div>
        <div>
          <dt className="text-gray-400 mb-0.5">프로젝트 수</dt>
          <dd className="font-medium text-gray-800">{client.projectCount}건</dd>
        </div>
        <div>
          <dt className="text-gray-400 mb-0.5">서비스 유형</dt>
          <dd className="font-medium text-gray-800">{SERVICE_TYPE_META[client.serviceType].label}</dd>
        </div>
        <div>
          <dt className="text-gray-400 mb-0.5">결제 방식</dt>
          <dd className="font-medium text-gray-800">{PAYMENT_TYPE_META[client.paymentType].label}</dd>
        </div>
        <div>
          <dt className="text-gray-400 mb-0.5">고객 등급</dt>
          <dd className="font-medium text-gray-800">
            <span className={`badge badge-sm ${client.tier === 'loyal' ? 'badge-blue' : 'badge-slate'}`}>
              {CLIENT_TIER_META[client.tier].label}
            </span>
          </dd>
        </div>
        <div className="md:col-span-2">
          <dt className="text-gray-400 mb-0.5">주소</dt>
          <dd className="font-medium text-gray-800">{client.address ?? '-'}</dd>
        </div>
        <div>
          <dt className="text-gray-400 mb-0.5">등록일</dt>
          <dd className="font-medium text-gray-800">{formatDate(client.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-gray-400 mb-0.5">상태</dt>
          <dd>
            <span className={`badge badge-sm ${client.isActive ? 'badge-green' : 'badge-slate'}`}>
              {client.isActive ? '활성' : '비활성'}
            </span>
          </dd>
        </div>
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
        <ActionButton label="수정" variant="secondary" onClick={() => alert('고객사 수정 (TODO)')} />
        <ActionButton
          label={client.isActive ? '비활성화' : '활성화'}
          variant={client.isActive ? 'danger' : 'primary'}
          onClick={() => alert('상태 변경 (TODO)')}
        />
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientListItem | null>(null);

  const filtered = MOCK_CLIENTS.filter((c) => {
    if (!showInactive && !c.isActive) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.contactName?.toLowerCase().includes(q) ?? false) ||
        (c.contactEmail?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">고객사</h1>
        <ActionButton
          label="+ 새 고객사"
          variant="primary"
          size="md"
          onClick={() => alert('새 고객사 등록 (TODO)')}
        />
      </div>

      {/* 필터 / 검색 */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="고객사명, 담당자, 이메일 검색..."
            className="form-input"
            style={{ maxWidth: 280 }}
          />
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            비활성 고객사 포함
          </label>
        </div>
      </div>

      {/* 선택된 고객사 상세 */}
      {selectedClient && (
        <ClientDetailPanel
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}

      {/* 고객사 테이블 */}
      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            조건에 맞는 고객사가 없습니다
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>고객사명</th>
                <th>서비스 유형</th>
                <th>결제 방식</th>
                <th>등급</th>
                <th>담당자</th>
                <th>연락처</th>
                <th>프로젝트</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedClient(c)}
                >
                  <td className="font-medium text-gray-900">{c.name}</td>
                  <td className="text-xs text-gray-600">{SERVICE_TYPE_META[c.serviceType].label}</td>
                  <td className="text-xs text-gray-600">{PAYMENT_TYPE_META[c.paymentType].label}</td>
                  <td>
                    <span className={`badge badge-sm ${c.tier === 'loyal' ? 'badge-blue' : 'badge-slate'}`}>
                      {CLIENT_TIER_META[c.tier].label}
                    </span>
                  </td>
                  <td className="text-gray-500">{c.contactName ?? '-'}</td>
                  <td className="text-gray-500 text-xs">{c.contactPhone ?? '-'}</td>
                  <td className="text-gray-700">{c.projectCount}건</td>
                  <td>
                    <span className={`badge badge-sm ${c.isActive ? 'badge-green' : 'badge-slate'}`}>
                      {c.isActive ? '활성' : '비활성'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-gray-400 text-right">
        총 {filtered.length}건
      </div>
    </div>
  );
}
