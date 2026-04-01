'use client';

/**
 * 새 프로젝트 생성 페이지
 *
 * 플로우:
 * 1. 고객사 선택 (또는 신규 등록)
 * 2. 서비스 유형 선택 (바이럴 / 퍼포먼스 / 바이럴+퍼포먼스)
 * 3. 프로젝트 기본 정보 입력
 * → 서비스 유형에 따라 이후 워크플로우가 결정됨
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LuMegaphone, LuChartBar, LuRocket } from 'react-icons/lu';
import { ActionButton } from '@/components/ui';
import { SERVICE_TYPE_META } from '@/lib/domain/types';
import type { ServiceType } from '@/lib/domain/types';
import styles from './new-project.module.css';

const SERVICE_ICONS: Record<ServiceType, React.ReactNode> = {
  viral: <LuMegaphone size={24} />,
  performance: <LuChartBar size={24} />,
  viral_performance: <LuRocket size={24} />,
};

/** 서비스 유형별 플로우 미리보기 */
const FLOW_PREVIEW: Record<ServiceType, string[]> = {
  viral: ['영업', '견적서(단일결제)', '승인', '입금 확인', '바이럴 집행', '완료'],
  performance: ['영업', '견적서(월계약)', '승인', '계약 체결', '입금 확인', '사전 보고서', '광고 집행', '완료'],
  viral_performance: ['영업', '견적서(월계약)', '승인', '계약 체결', '입금 확인', '사전 보고서', '광고+바이럴 집행', '완료'],
};

// ── Mock 고객사 목록 ──

const MOCK_CLIENTS = [
  { id: 'c1', name: '(주)블루오션 마케팅' },
  { id: 'c2', name: '그린텍' },
  { id: 'c3', name: '스카이미디어' },
  { id: 'c4', name: '하이브랜드' },
  { id: 'c5', name: '오렌지원' },
  { id: 'c6', name: '모어마케팅' },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !serviceType || !title) {
      alert('고객사, 서비스 유형, 프로젝트명은 필수입니다.');
      return;
    }
    // TODO: API 연결
    alert(`프로젝트 생성: ${title} (${SERVICE_TYPE_META[serviceType].label})`);
    router.push('/projects');
  }

  return (
    <div className="page-container">
      {/* 브레드크럼 */}
      <nav>
        <ol className="flex items-center text-xs text-gray-400 gap-1.5">
          <li><a href="/projects" className="hover:text-gray-600">프로젝트</a></li>
          <li>/</li>
          <li className="text-gray-600">새 프로젝트</li>
        </ol>
      </nav>

      <h1 className="text-lg font-semibold text-gray-900">새 프로젝트 생성</h1>

      <form onSubmit={handleSubmit} className="card">
        <div className={styles.formGrid}>

          {/* 1. 고객사 선택 */}
          <div className={styles.fullWidth}>
            <label className={styles.formLabel}>고객사 *</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="form-input"
            >
              <option value="">고객사를 선택하세요</option>
              {MOCK_CLIENTS.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 2. 서비스 유형 선택 */}
          <div className={styles.fullWidth}>
            <label className={styles.formLabel}>서비스 유형 *</label>
            <p className={styles.formHint}>서비스 유형에 따라 프로젝트 워크플로우가 결정됩니다</p>
          </div>

          <div className={styles.serviceSelector}>
            {(['viral', 'performance', 'viral_performance'] as ServiceType[]).map((st) => (
              <button
                key={st}
                type="button"
                className={`${styles.serviceCard} ${serviceType === st ? styles.serviceCardSelected : ''}`}
                onClick={() => setServiceType(st)}
              >
                <span className={styles.serviceIcon}>{SERVICE_ICONS[st]}</span>
                <span className={styles.serviceName}>{SERVICE_TYPE_META[st].label}</span>
                <span className={styles.serviceDesc}>{SERVICE_TYPE_META[st].description}</span>
              </button>
            ))}
          </div>

          {/* 플로우 미리보기 */}
          {serviceType && (
            <div className={styles.flowPreview}>
              <div className={styles.flowPreviewTitle}>워크플로우 미리보기</div>
              <div className={styles.flowSteps}>
                {FLOW_PREVIEW[serviceType].map((step, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className={styles.flowArrow}>→</span>}
                    <span className={styles.flowStep}>{step}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 3. 프로젝트 기본 정보 */}
          <div className={styles.fullWidth}>
            <label className={styles.formLabel}>프로젝트명 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 블루오션 4월 마케팅 대행"
              className="form-input"
            />
          </div>

          <div className={styles.fullWidth}>
            <label className={styles.formLabel}>설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="프로젝트에 대한 간단한 설명"
              className="form-input"
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div>
            <label className={styles.formLabel}>시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className={styles.formLabel}>종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className={styles.formLabel}>계약 금액 (원)</label>
            <input
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0"
              className="form-input"
            />
          </div>

          {/* 액션 */}
          <div className={styles.actions}>
            <ActionButton
              label="취소"
              variant="ghost"
              size="md"
              onClick={() => router.push('/projects')}
            />
            <ActionButton
              label="프로젝트 생성"
              variant="primary"
              size="md"
              onClick={() => { /* form submit handles it */ }}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
