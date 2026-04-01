'use client';

/**
 * 문서 상세 페이지
 *
 * 문서 내용 확인 + 승인 프로세스 + 발송 처리
 * URL: /projects/[id]/documents/[docId]
 */

import { useRouter } from 'next/navigation';
import { StatusBadge, ActionButton } from '@/components/ui';
import { DOCUMENT_TYPE_META, DOCUMENT_STATUS_META } from '@/lib/domain/types';
import type { ProjectDocument, UserRole, DocumentStatus } from '@/lib/domain/types';
import styles from '../document-form.module.css';

// ── Mock 데이터 ──

const MOCK_DOCUMENT: ProjectDocument = {
  id: 'doc1',
  project_id: 'p1',
  type: 'estimate',
  status: 'approved',
  version: 1,
  title: '2026년 3월 마케팅 대행 견적서',
  content: {
    items: [
      { name: '인스타그램 피드 콘텐츠 (10건)', quantity: 10, unit_price: 150000, amount: 1500000 },
      { name: '네이버 블로그 포스팅 (8건)', quantity: 8, unit_price: 200000, amount: 1600000 },
      { name: '광고 대행 수수료', quantity: 1, unit_price: 500000, amount: 500000 },
    ],
    subtotal: 3600000,
    tax: 360000,
    total: 3960000,
    notes: 'VAT 별도. 추가 건수 발생 시 별도 협의.',
  },
  is_sent: false,
  sent_at: null,
  sent_by: null,
  sent_to: null,
  created_by: 'u2',
  metadata: {},
  created_at: '2026-03-03T10:00:00Z',
  updated_at: '2026-03-05T14:30:00Z',
};

const MOCK_APPROVAL_STEPS = [
  { step: 1, label: '매니저 승인', status: 'approved' as const, approverName: '김민수', actionedAt: '2026-03-04T11:20:00Z' },
  { step: 2, label: '대표 승인', status: 'approved' as const, approverName: '박대표', actionedAt: '2026-03-05T09:15:00Z' },
];

const MOCK_USER_ROLE: UserRole = 'manager';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── 문서 내용 렌더러 ──

function EstimateContent({ content }: { content: Record<string, unknown> }) {
  const items = (content.items ?? []) as { name: string; quantity: number; unit_price: number; amount: number }[];
  const subtotal = (content.subtotal ?? 0) as number;
  const tax = (content.tax ?? 0) as number;
  const total = (content.total ?? 0) as number;
  const notes = (content.notes ?? '') as string;

  return (
    <>
      <table className={styles.itemsTable}>
        <thead>
          <tr>
            <th>항목명</th>
            <th style={{ textAlign: 'right' }}>수량</th>
            <th style={{ textAlign: 'right' }}>단가</th>
            <th style={{ textAlign: 'right' }}>금액</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td>{item.name}</td>
              <td style={{ textAlign: 'right' }}>{item.quantity}</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(item.unit_price)}원</td>
              <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatCurrency(item.amount)}원</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.totalArea}>
        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>소계</span>
          <span className={styles.totalValue}>{formatCurrency(subtotal)}원</span>
        </div>
        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>부가세</span>
          <span className={styles.totalValue}>{formatCurrency(tax)}원</span>
        </div>
        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>합계</span>
          <span className={`${styles.totalValue} ${styles.totalGrand}`}>{formatCurrency(total)}원</span>
        </div>
      </div>
      {notes && (
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          비고: {notes}
        </p>
      )}
    </>
  );
}

function ContractContent({ content }: { content: Record<string, unknown> }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <dt style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>계약 조건</dt>
        <dd style={{ whiteSpace: 'pre-wrap' }}>{(content.terms ?? '-') as string}</dd>
      </div>
      <div>
        <dt style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>계약일</dt>
        <dd>{(content.contract_date ?? '-') as string}</dd>
      </div>
      <div>
        <dt style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>효력일</dt>
        <dd>{(content.effective_date ?? '-') as string}</dd>
      </div>
      <div>
        <dt style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>만료일</dt>
        <dd>{(content.expiry_date ?? '-') as string}</dd>
      </div>
    </div>
  );
}

function ReportContent({ content }: { content: Record<string, unknown> }) {
  const body = (content.body ?? content.report ?? '') as string;
  return (
    <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7 }}>
      {body || '(내용 없음)'}
    </div>
  );
}

function DocumentContent({ doc }: { doc: ProjectDocument }) {
  const content = doc.content as Record<string, unknown>;
  switch (doc.type) {
    case 'estimate': return <EstimateContent content={content} />;
    case 'contract': return <ContractContent content={content} />;
    case 'pre_report':
    case 'report': return <ReportContent content={content} />;
    default: return <pre style={{ fontSize: 12 }}>{JSON.stringify(content, null, 2)}</pre>;
  }
}

// ── 승인 이력 ──

function ApprovalHistory({ steps }: { steps: typeof MOCK_APPROVAL_STEPS }) {
  if (steps.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <h3 className="section-title" style={{ marginBottom: 10 }}>승인 이력</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((s) => (
          <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span
              className={`badge badge-sm ${s.status === 'approved' ? 'badge-green' : s.status === 'pending' ? 'badge-yellow' : 'badge-gray'}`}
            >
              {s.label}
            </span>
            {s.status === 'approved' && (
              <>
                <span style={{ color: 'var(--color-text-secondary)' }}>{s.approverName}</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{formatDateTime(s.actionedAt)}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 문서 액션 버튼 ──

function DocumentActions({
  status,
  isSent,
  userRole,
}: {
  status: DocumentStatus;
  isSent: boolean;
  userRole: UserRole;
}) {
  const isManagerOrAbove = userRole === 'manager' || userRole === 'admin';

  switch (status) {
    case 'draft':
    case 'rejected':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionButton label="수정" variant="secondary" size="md" onClick={() => alert('수정 (TODO)')} />
          <ActionButton label="승인 요청" variant="primary" size="md" onClick={() => alert('승인 요청 (TODO)')} />
        </div>
      );
    case 'in_review':
      return isManagerOrAbove ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionButton label="승인" variant="primary" size="md" onClick={() => alert('승인 (TODO)')} />
          <ActionButton label="반려" variant="danger" size="md" onClick={() => {
            const reason = prompt('반려 사유를 입력해주세요.');
            if (reason) alert(`반려: ${reason} (TODO)`);
          }} />
        </div>
      ) : null;
    case 'approved':
      return !isSent ? (
        <ActionButton label="고객에게 발송" variant="primary" size="md" onClick={() => alert('발송 (TODO)')} />
      ) : null;
    case 'sent':
      return <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>발송 완료</span>;
    default:
      return null;
  }
}

// ── Page ──

export default function DocumentDetailPage() {
  const router = useRouter();
  const doc = MOCK_DOCUMENT;
  const typeMeta = DOCUMENT_TYPE_META[doc.type];

  return (
    <div className="page-container">
      {/* 브레드크럼 */}
      <nav>
        <ol className="flex items-center text-xs text-gray-400 gap-1.5">
          <li><a href="/projects" className="hover:text-gray-600">프로젝트</a></li>
          <li>/</li>
          <li><a href={`/projects/${doc.project_id}`} className="hover:text-gray-600">블루오션 3월 마케팅 대행</a></li>
          <li>/</li>
          <li className="text-gray-600">{typeMeta.label}</li>
        </ol>
      </nav>

      {/* 문서 헤더 */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge badge-sm badge-blue">{typeMeta.label}</span>
            <StatusBadge status={doc.status} type="document" size="md" />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>v{doc.version}</span>
          </div>
          <DocumentActions status={doc.status} isSent={doc.is_sent} userRole={MOCK_USER_ROLE} />
        </div>

        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
          {doc.title}
        </h1>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          작성일: {formatDateTime(doc.created_at)} · 최종 수정: {formatDateTime(doc.updated_at)}
          {doc.is_sent && doc.sent_at && ` · 발송일: ${formatDateTime(doc.sent_at)}`}
          {doc.sent_to && ` · 수신: ${doc.sent_to}`}
        </p>
      </div>

      {/* 문서 내용 */}
      <div className="card">
        <h2 className="section-title" style={{ marginBottom: 14 }}>문서 내용</h2>
        <DocumentContent doc={doc} />
      </div>

      {/* 승인 이력 */}
      <div className="card">
        <ApprovalHistory steps={MOCK_APPROVAL_STEPS} />
      </div>
    </div>
  );
}
