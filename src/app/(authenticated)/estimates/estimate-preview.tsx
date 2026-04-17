'use client';

import React, { useState, useRef, useLayoutEffect, useEffect, useMemo, type ReactNode } from 'react';
import type { EstimateContent } from '@/lib/domain/types';
import s from './estimate-editor.module.css';

/* ── A4 at ~96 DPI ── */
const A4_W = 794;
const A4_H = 1123;
const PAD_V = 48;
const CONTENT_H = A4_H - PAD_V * 2; // 1027px usable height

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n) + ' 원';
}

function fmtDateKR(d?: string) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}년 ${String(dt.getMonth() + 1).padStart(2, '0')}월 ${String(dt.getDate()).padStart(2, '0')}일`;
}

interface EstimatePreviewProps {
  data: EstimateContent;
}

export function EstimatePreview({ data }: EstimatePreviewProps) {
  const {
    document_number, recipient, sender, contract_period,
    issued_date, items = [], subtotal = 0, tax_rate = 10, tax = 0, total = 0,
    notes = [], company_name, company_address, company_representative,
  } = data;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [pageGroups, setPageGroups] = useState<number[][] | null>(null);
  const [scale, setScale] = useState(1);
  const prevHeightsRef = useRef<string>('');

  /* ── Build content blocks ── */
  const blocks = useMemo<ReactNode[]>(() => {
    const b: ReactNode[] = [];

    // Block 0: Header + Title
    b.push(
      <div key="head">
        <div className={s.docHeader}>
          <span className={s.docCompany}>{company_name || sender || '회사명'}</span>
          <span className={s.docTypeTag}>견적서</span>
        </div>
        <h1 className={s.docTitle}>견 적 서</h1>
      </div>,
    );

    // Block 1: Info Table
    b.push(
      <table key="info" className={s.infoTable}>
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
            <td className={s.infoValue}>{fmtDateKR(issued_date) || '-'}</td>
          </tr>

        </tbody>
      </table>,
    );

    // Block 2: Detail Section (title + table)
    b.push(
      <div key="detail">
        <div className={s.sectionTitle}>상세 견적 내역</div>
        <table className={s.detailTable}>
          <thead>
            <tr>
              <th className={s.colNo}>No.</th>
              <th className={s.colCategory}>카테고리</th>
              <th className={s.colDetails}>세부 항목</th>
              <th className={s.colPrice}>단가 (월)</th>
              <th className={s.colNote}>비고</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>
                  항목을 추가하세요
                </td>
              </tr>
            ) : items.map((item, idx) => {
              const hasOptions = item.options && item.options.length > 0;
              return (
                <React.Fragment key={idx}>
                  <tr>
                    <td className={s.colNo} rowSpan={hasOptions ? 1 + item.options!.length : 1}>{item.no}</td>
                    <td className={s.colCategory} rowSpan={hasOptions ? 1 + item.options!.length : 1}>{item.category || '-'}</td>
                    <td className={s.colDetails}>
                      {item.details.map((detail, di) => (
                        <div key={di} className={di < item.details.length - 1 ? s.detailGroupSeparated : undefined}>
                          <div className={s.detailGroupTitle}>{detail.title}</div>
                          {detail.descriptions.map((desc, ddi) => (
                            <p key={ddi} className={s.detailGroupDesc}>{desc}</p>
                          ))}
                        </div>
                      ))}
                    </td>
                    <td className={s.colPrice}>{fmtCurrency(item.unit_price)}</td>
                    <td className={s.colNote}>{item.note || ''}</td>
                  </tr>
                  {hasOptions && item.options!.map((opt, oi) => (
                    <tr key={`opt-${oi}`} className={s.optionPreviewRow}>
                      <td className={s.colDetails}>
                        <span className={s.optionTag}>옵션</span> {opt.name}
                      </td>
                      <td className={s.colPrice}>{fmtCurrency(opt.price)}</td>
                      <td className={s.colNote}></td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>,
    );

    // Block 3: Summary Table
    b.push(
      <table key="sum" className={s.summaryTable}>
        <tbody>
          <tr>
            <td className={s.summaryLabel}>대행 수수료 (공급가액)</td>
            <td className={s.summaryValue}>{fmtCurrency(subtotal)}</td>
          </tr>
          <tr>
            <td className={s.summaryLabel}>부가세 (VAT {tax_rate}%)</td>
            <td className={s.summaryValue}>{fmtCurrency(tax)}</td>
          </tr>
          <tr className={s.summaryTotal}>
            <td className={s.summaryLabel}>총 결제금액 (VAT 포함)</td>
            <td className={s.summaryValue}>{fmtCurrency(total)}</td>
          </tr>
        </tbody>
      </table>,
    );

    // Block 4: Notes (optional)
    if (notes.length > 0) {
      b.push(
        <div key="notes" className={s.docNotes}>
          <div className={s.docNotesTitle}>참고 사항</div>
          <ol className={s.docNotesList}>
            {notes.map((note, i) => (
              <li key={i}>{i + 1}. {note}</li>
            ))}
          </ol>
        </div>,
      );
    }

    // Block 5: Footer (optional)
    if (company_name || company_address || company_representative) {
      b.push(
        <div key="foot" className={s.docFooter}>
          {[company_name, company_address, company_representative ? `COO ${company_representative}` : '']
            .filter(Boolean)
            .join(' | ')}
        </div>,
      );
    }

    return b;
  }, [document_number, recipient, sender, contract_period,
      issued_date, items, subtotal, tax_rate, tax, total, notes,
      company_name, company_address, company_representative]);

  /* ── Measure blocks & paginate ── */
  useLayoutEffect(() => {
    const mEl = measureRef.current;
    const wEl = wrapperRef.current;
    if (!mEl || mEl.children.length === 0) return;

    const children = Array.from(mEl.children) as HTMLElement[];
    const totalH = mEl.scrollHeight;

    // Calculate height each block occupies in normal flow
    const blockHeights: number[] = [];
    for (let i = 0; i < children.length; i++) {
      if (i < children.length - 1) {
        blockHeights.push(children[i + 1].offsetTop - children[i].offsetTop);
      } else {
        blockHeights.push(totalH - children[i].offsetTop);
      }
    }

    // Skip re-pagination if block heights haven't changed
    const key = blockHeights.map(h => Math.round(h)).join(',');
    if (key === prevHeightsRef.current) return;
    prevHeightsRef.current = key;

    // Assign blocks to pages
    const pages: number[][] = [[]];
    let usedH = 0;
    for (let i = 0; i < blockHeights.length; i++) {
      if (usedH + blockHeights[i] > CONTENT_H && pages[pages.length - 1].length > 0) {
        pages.push([]);
        usedH = 0;
      }
      pages[pages.length - 1].push(i);
      usedH += blockHeights[i];
    }

    setPageGroups(pages);

    // Initial scale
    if (wEl) {
      const availW = wEl.getBoundingClientRect().width;
      setScale(Math.min(1, availW / A4_W));
    }
  }, [blocks]);

  /* ── Responsive scaling ── */
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / A4_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const effectivePages = pageGroups ?? [blocks.map((_, i) => i)];
  const totalPages = effectivePages.length;

  return (
    <div ref={wrapperRef} className={s.previewWrapper}>
      {/* Hidden measurement container (same content width as A4 page) */}
      <div ref={measureRef} className={s.measureContainer} aria-hidden="true">
        {blocks.map((node, i) => <div key={i}>{node}</div>)}
      </div>

      {/* Rendered A4 pages */}
      {effectivePages.map((indices, pageIdx) => (
        <div
          key={pageIdx}
          className={s.a4PageOuter}
          style={{
            width: A4_W * scale,
            height: A4_H * scale,
          }}
        >
          <div
            className={s.a4Page}
            style={{ transform: `scale(${scale})` }}
          >
            {indices.map(i => <div key={i}>{blocks[i]}</div>)}
            {totalPages > 1 && (
              <span className={s.pageNumber}>{pageIdx + 1} / {totalPages}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
