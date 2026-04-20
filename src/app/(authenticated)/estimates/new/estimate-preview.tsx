'use client';

import type { EstimateContent } from '@/lib/domain/types';
import s from './estimate.module.css';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n) + ' 원';
}

function formatDateKR(d?: string) {
  if (!d) return '';
  const date = new Date(d);
  return `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, '0')}월 ${String(date.getDate()).padStart(2, '0')}일`;
}

interface EstimatePreviewProps {
  data: EstimateContent;
}

export function EstimatePreview({ data }: EstimatePreviewProps) {
  const {
    document_number,
    recipient,
    sender,
    project_name,
    contract_period,
    issued_date,
    items = [],
    subtotal = 0,
    tax_rate = 10,
    tax = 0,
    total = 0,
    notes = [],
    company_name,
    company_address,
    company_representative,
  } = data;

  return (
    <div className={s.previewContainer}>
      {/* ── Header ── */}
      <div className={s.docHeader}>
        <span className={s.docCompany}>{company_name || sender || '회사명'}</span>
        <span className={s.docTypeTag}>견적서</span>
      </div>

      {/* ── Title ── */}
      <h1 className={s.docTitle}>견 적 서</h1>

      {/* ── Info Table ── */}
      <table className={s.infoTable}>
        <tbody>
          <tr>
            <td className={s.infoLabel}>수 신</td>
            <td className={s.infoValue}>{recipient || '-'}</td>
            <td className={s.infoLabel}>발 신</td>
            <td className={s.infoValue}>{sender || '-'}</td>
          </tr>
          <tr>
            <td className={s.infoLabel}>문서번호</td>
            <td className={s.infoValue}>{document_number || '-'}</td>
            <td className={s.infoLabel}>작성일자</td>
            <td className={s.infoValue}>{formatDateKR(issued_date) || '-'}</td>
          </tr>
          <tr>
            <td className={s.infoLabel}>프로젝트</td>
            <td className={s.infoValue} colSpan={3}>{project_name || '-'}</td>
          </tr>

        </tbody>
      </table>

      {/* ── Detail Table ── */}
      <div className={s.sectionTitle}>상세 견적 내역</div>
      <table className={s.detailTable}>
        <thead>
          <tr>
            <th className={s.colNo}>No.</th>
            <th className={s.colCategory}>카테고리</th>
            <th className={s.colDetails}>세부 항목</th>
            <th className={s.colPrice}>단가</th>
            <th className={s.colPrice}>수량</th>
            <th className={s.colPrice}>공급가</th>
            <th className={s.colNote}>비고</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>
                항목을 추가하세요
              </td>
            </tr>
          )}
          {items.map((item, idx) => {
            const qty = item.quantity ?? 1;
            const amount = (item.unit_price || 0) * qty;
            return (
              <tr key={idx}>
                <td className={s.colNo}>{item.no}</td>
                <td className={s.colCategory}>{item.category || '-'}</td>
                <td className={s.colDetails}>
                  {item.details.map((detail, di) => (
                    <div key={di} style={{ marginBottom: di < item.details.length - 1 ? 8 : 0 }}>
                      <div className={s.detailGroupTitle}>{detail.title}</div>
                      {detail.descriptions.map((desc, ddi) => (
                        <p key={ddi} className={s.detailGroupDesc}>{desc}</p>
                      ))}
                    </div>
                  ))}
                </td>
                <td className={s.colPrice}>{formatCurrency(item.unit_price)}</td>
                <td className={s.colPrice}>{qty}</td>
                <td className={s.colPrice}>{formatCurrency(amount)}</td>
                <td className={s.colNote}>{item.note || ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── Summary ── */}
      <table className={s.summaryTable}>
        <tbody>
          <tr>
            <td className={s.summaryLabel}>총 공급가</td>
            <td className={s.summaryValue}>{formatCurrency(subtotal)}</td>
          </tr>
          <tr>
            <td className={s.summaryLabel}>부가세 (VAT {tax_rate}%)</td>
            <td className={s.summaryValue}>{formatCurrency(tax)}</td>
          </tr>
          <tr className={s.summaryTotal}>
            <td className={s.summaryLabel}>총 결제금액 (VAT 포함)</td>
            <td className={s.summaryValue}>{formatCurrency(total)}</td>
          </tr>
        </tbody>
      </table>

      {/* ── Notes ── */}
      {notes.length > 0 && (
        <div className={s.docNotes}>
          <div className={s.docNotesTitle}>참고 사항</div>
          <ol className={s.docNotesList}>
            {notes.map((note, i) => (
              <li key={i}>{i + 1}. {note}</li>
            ))}
          </ol>
        </div>
      )}

      {/* ── Footer ── */}
      {(company_name || company_address || company_representative) && (
        <div className={s.docFooter}>
          {[company_name, company_address, company_representative ? `COO ${company_representative}` : '']
            .filter(Boolean)
            .join(' | ')}
        </div>
      )}
    </div>
  );
}
