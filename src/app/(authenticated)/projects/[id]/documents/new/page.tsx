'use client';

/**
 * 문서 생성 페이지
 *
 * 프로젝트의 서비스 유형과 현재 상태에 따라 생성 가능한 문서 유형이 결정됨.
 * - 바이럴: 견적서(단일결제) → 보고서
 * - 퍼포먼스/바이럴+퍼포먼스: 견적서(월계약) → 계약서 → 사전보고서 → 보고서
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ActionButton } from '@/components/ui';
import {
  DOCUMENT_TYPE_META,
  DOCUMENT_TYPES,
  getAllowedDocumentTypes,
} from '@/lib/domain/types';
import type { DocumentType, ServiceType, ProjectStatus } from '@/lib/domain/types';
import styles from '../document-form.module.css';

// ── Mock: 현재 프로젝트 정보 (실제로는 서버에서 조회) ──

const MOCK_PROJECT = {
  id: 'p1',
  title: '블루오션 3월 마케팅 대행',
  status: 'running' as ProjectStatus,
  serviceType: 'viral_performance' as ServiceType,
};

interface EstimateItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n);
}

export default function NewDocumentPage() {
  const router = useRouter();
  const project = MOCK_PROJECT;

  const allowedTypes = useMemo(
    () => getAllowedDocumentTypes(project.status, project.serviceType),
    [project.status, project.serviceType],
  );

  const [docType, setDocType] = useState<DocumentType | ''>('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  // 견적서 전용
  const [items, setItems] = useState<EstimateItem[]>([
    { name: '', quantity: 1, unitPrice: 0 },
  ]);

  // 계약서 전용
  const [contractTerms, setContractTerms] = useState('');
  const [contractDate, setContractDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  // 보고서/사전보고서 전용
  const [reportBody, setReportBody] = useState('');

  // 견적서 합계 계산
  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
  const tax = Math.round(subtotal * 0.1);
  const total = subtotal + tax;

  function addItem() {
    setItems([...items, { name: '', quantity: 1, unitPrice: 0 }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof EstimateItem, value: string | number) {
    setItems(items.map((it, i) => i === index ? { ...it, [field]: value } : it));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!docType || !title) {
      alert('문서 유형과 제목은 필수입니다.');
      return;
    }
    // TODO: API 연결
    alert(`문서 생성: [${DOCUMENT_TYPE_META[docType].label}] ${title}`);
    router.push(`/projects/${project.id}`);
  }

  return (
    <div className="page-container">
      {/* 브레드크럼 */}
      <nav>
        <ol className="flex items-center text-xs text-gray-400 gap-1.5">
          <li><a href="/projects" className="hover:text-gray-600">프로젝트</a></li>
          <li>/</li>
          <li><a href={`/projects/${project.id}`} className="hover:text-gray-600">{project.title}</a></li>
          <li>/</li>
          <li className="text-gray-600">새 문서</li>
        </ol>
      </nav>

      <h1 className="text-lg font-semibold text-gray-900">새 문서 작성</h1>

      <form onSubmit={handleSubmit}>
        {/* 문서 유형 선택 */}
        <div className="card">
          <div className={styles.formSection}>
            <label className={styles.formLabel}>문서 유형 *</label>
            <p className={styles.formHint}>
              현재 프로젝트 상태에서 생성 가능한 문서 유형만 선택할 수 있습니다
            </p>
            <div className={styles.typeSelector} style={{ marginTop: 10 }}>
              {DOCUMENT_TYPES.map((dt) => {
                const meta = DOCUMENT_TYPE_META[dt];
                const allowed = allowedTypes.includes(dt);
                return (
                  <button
                    key={dt}
                    type="button"
                    disabled={!allowed}
                    className={`${styles.typeCard} ${docType === dt ? styles.typeCardSelected : ''} ${!allowed ? styles.typeCardDisabled : ''}`}
                    onClick={() => allowed && setDocType(dt)}
                  >
                    <span className={styles.typeName}>{meta.label}</span>
                    <span className={styles.typeDesc}>{meta.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 기본 정보 */}
        {docType && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className={styles.formSection}>
              <label className={styles.formLabel}>제목 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${DOCUMENT_TYPE_META[docType].label} 제목을 입력하세요`}
                className="form-input"
              />
            </div>

            {/* ── 견적서 내용 ── */}
            {docType === 'estimate' && (
              <div className={styles.formSection}>
                <label className={styles.formLabel}>견적 항목</label>
                <table className={styles.itemsTable}>
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>항목명</th>
                      <th style={{ width: '15%' }}>수량</th>
                      <th style={{ width: '20%' }}>단가 (원)</th>
                      <th style={{ width: '20%' }}>금액</th>
                      <th style={{ width: '5%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            value={item.name}
                            onChange={(e) => updateItem(i, 'name', e.target.value)}
                            placeholder="항목명"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 0)}
                            min={1}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(i, 'unitPrice', parseInt(e.target.value) || 0)}
                            min={0}
                          />
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </td>
                        <td>
                          {items.length > 1 && (
                            <button type="button" onClick={() => removeItem(i)} className="btn btn-ghost btn-sm">×</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 8 }}>
                  <ActionButton label="+ 항목 추가" variant="ghost" onClick={addItem} />
                </div>

                {/* 합계 */}
                <div className={styles.totalArea}>
                  <div className={styles.totalRow}>
                    <span className={styles.totalLabel}>소계</span>
                    <span className={styles.totalValue}>{formatCurrency(subtotal)}원</span>
                  </div>
                  <div className={styles.totalRow}>
                    <span className={styles.totalLabel}>부가세 (10%)</span>
                    <span className={styles.totalValue}>{formatCurrency(tax)}원</span>
                  </div>
                  <div className={styles.totalRow}>
                    <span className={styles.totalLabel}>합계</span>
                    <span className={`${styles.totalValue} ${styles.totalGrand}`}>{formatCurrency(total)}원</span>
                  </div>
                </div>

                <div className={styles.formSection} style={{ marginTop: 16 }}>
                  <label className={styles.formLabel}>비고</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="VAT 별도, 추가 건수 발생 시 별도 협의 등"
                    className="form-input"
                    rows={2}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* ── 계약서 내용 ── */}
            {docType === 'contract' && (
              <div className={styles.formSection}>
                <label className={styles.formLabel}>계약 조건</label>
                <textarea
                  value={contractTerms}
                  onChange={(e) => setContractTerms(e.target.value)}
                  placeholder="계약 기간, 서비스 범위, 대금 지급 조건 등"
                  className="form-input"
                  rows={5}
                  style={{ resize: 'vertical' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                  <div>
                    <label className={styles.formLabel}>계약일</label>
                    <input
                      type="date"
                      value={contractDate}
                      onChange={(e) => setContractDate(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className={styles.formLabel}>만료일</label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── 보고서/사전보고서 내용 ── */}
            {(docType === 'pre_report' || docType === 'report') && (
              <div className={styles.formSection}>
                <label className={styles.formLabel}>
                  {docType === 'pre_report' ? '집행 사전 보고서 내용' : '보고서 내용'}
                </label>
                <textarea
                  value={reportBody}
                  onChange={(e) => setReportBody(e.target.value)}
                  placeholder={
                    docType === 'pre_report'
                      ? '집행 계획, 일정, 예상 성과 등을 작성하세요'
                      : '집행 결과, 성과 분석, 인사이트 등을 작성하세요'
                  }
                  className="form-input"
                  rows={10}
                  style={{ resize: 'vertical' }}
                />
              </div>
            )}

            {/* 액션 */}
            <div className={styles.actions}>
              <ActionButton
                label="취소"
                variant="ghost"
                size="md"
                onClick={() => router.push(`/projects/${project.id}`)}
              />
              <ActionButton
                label={`${docType ? DOCUMENT_TYPE_META[docType].label : '문서'} 저장`}
                variant="primary"
                size="md"
              />
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
