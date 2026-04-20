'use client';

/**
 * CampaignPlanPreview — 캠페인 진행안 A4 미리보기
 *
 * 견적서 미리보기와 동일한 블록 측정 + 페이지네이션 구조 사용.
 * 이미지 디자인: 다크 헤더 + 집행 기간 바 + 서비스 카드 + 월 총 집행 금액 + 푸터
 */

import React, { useState, useRef, useLayoutEffect, useEffect, useMemo, type ReactNode } from 'react';
import type { PreReportContent } from '@/lib/domain/types';
import s from '../estimates/estimate-editor.module.css';
import cp from './campaign-plan.module.css';

/* ── A4 at ~96 DPI ── */
const A4_W = 794;
const A4_H = 1123;
const PAD_V = 48;
const CONTENT_H = A4_H - PAD_V * 2;

function fmtKRW(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n);
}

function fmtDateKR(d?: string) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}년 ${String(dt.getMonth() + 1).padStart(2, '0')}월 ${String(dt.getDate()).padStart(2, '0')}일`;
}

const ICON_MAP: Record<string, string> = {
  shopping_reward: '🛒',
  cafe_viral: '💬',
  blog_viral: '📝',
  sns: '📱',
  sa_ad: '🔍',
  meta_ad: '📣',
  google_ad: '🌐',
  design: '🎨',
  video: '🎬',
  other: '📋',
};

interface CampaignPlanPreviewProps {
  data: PreReportContent;
}

export function CampaignPlanPreview({ data }: CampaignPlanPreviewProps) {
  const {
    recipient, project_name, issued_date,
    execution_months = 1, execution_period_unit = 'month', execution_note,
    services = [], total_monthly = 0,
    company_name, vat_note,
  } = data;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [pageGroups, setPageGroups] = useState<number[][] | null>(null);
  const [scale, setScale] = useState(1);
  const prevHeightsRef = useRef<string>('');

  /* ── Build blocks ── */
  const blocks = useMemo<ReactNode[]>(() => {
    const b: ReactNode[] = [];

    // Block 0: Dark header
    b.push(
      <div key="head" className={cp.cpHeader}>
        <div className={cp.cpHeaderLeft}>
          <span className={cp.cpHeaderClient}>{recipient || '고객사명'}</span>
          <span className={cp.cpHeaderSubtitle}>마케팅 캠페인 진행안</span>
        </div>
        <div className={cp.cpHeaderRight}>
          {issued_date && <span className={cp.cpHeaderDate}>작성일 : {fmtDateKR(issued_date)}</span>}
          <span className={cp.cpHeaderBadge}>CAMPAIGN PLAN</span>
        </div>
      </div>,
    );

    // Block 1: Execution period bar
    b.push(
      <div key="period" className={cp.cpPeriodBar}>
        <span className={cp.cpPeriodLabel}>집행 기간</span>
        <span className={cp.cpPeriodValue}>
          {execution_months}{execution_period_unit === 'week' ? '주' : '개월'}
          {execution_note && <span className={cp.cpPeriodNote}>({execution_note})</span>}
        </span>
      </div>,
    );

    // Block 2: Section title
    b.push(
      <div key="svc-title" className={cp.cpSectionTitle}>서비스 구성</div>,
    );

    // Block 3+: Service cards
    services.forEach((svc, idx) => {
      const icon = ICON_MAP[svc.icon || 'other'] || '📋';
      const quantity = svc.quantity ?? 1;
      const unitPrice = svc.unit_price ?? (svc.subtotal != null && quantity > 0 ? Math.round((svc.subtotal ?? 0) / quantity) : 0);
      const supply = unitPrice * quantity;
      b.push(
        <div key={`svc-${idx}`} className={cp.cpServiceCard}>
          <div className={cp.cpServiceHeader}>
            <span className={cp.cpServiceIcon}>{icon}</span>
            <span className={cp.cpServiceName}>{svc.name || '서비스명'}</span>
          </div>
          <div className={cp.cpServiceFields}>
            {(svc.fields ?? []).filter(f => f.label || f.value).map((field, fi) => (
              <div key={fi} className={cp.cpFieldRow}>
                <span className={cp.cpFieldLabel}>{field.label}</span>
                <span className={cp.cpFieldValue}>{field.value}</span>
              </div>
            ))}
            {unitPrice > 0 && (
              <div className={cp.cpFieldRow}>
                <span className={cp.cpFieldLabel}>단가</span>
                <span className={cp.cpFieldValue}>{fmtKRW(unitPrice)}원</span>
              </div>
            )}
            {quantity > 0 && (
              <div className={cp.cpFieldRow}>
                <span className={cp.cpFieldLabel}>수량</span>
                <span className={cp.cpFieldValue}>{quantity}</span>
              </div>
            )}
            {supply > 0 && (
              <div className={`${cp.cpFieldRow} ${cp.cpFieldSubtotal}`}>
                <span className={cp.cpFieldLabel}>공급가</span>
                <span className={cp.cpFieldValue}>{fmtKRW(supply)}원</span>
              </div>
            )}
          </div>
        </div>,
      );
    });

    if (services.length === 0) {
      b.push(
        <div key="svc-empty" className={cp.cpServiceCard} style={{ textAlign: 'center', color: '#9ca3af', padding: '32px 0' }}>
          서비스를 추가하세요
        </div>,
      );
    }

    // Block N-1: Total
    const unitLabel = execution_period_unit === 'week' ? '주' : '월';
    const totalAmount = total_monthly * execution_months;
    b.push(
      <div key="total" className={cp.cpTotalBar}>
        <span className={cp.cpTotalLabel}>총 집행 금액</span>
        <span className={cp.cpTotalValue}>
          {execution_months > 1
            ? `${fmtKRW(total_monthly)} 원/${unitLabel} x ${execution_months}${unitLabel} → ${fmtKRW(totalAmount)}원`
            : `${fmtKRW(total_monthly)} 원/${unitLabel}`
          }
        </span>
      </div>,
    );

    // Block N: Footer
    if (company_name || vat_note) {
      b.push(
        <div key="foot" className={cp.cpFooter}>
          {[company_name, vat_note].filter(Boolean).join(' | ')}
        </div>,
      );
    }

    return b;
  }, [recipient, project_name, issued_date, execution_months, execution_period_unit, execution_note, services, total_monthly, company_name, vat_note]);

  /* ── Measure blocks & paginate ── */
  useLayoutEffect(() => {
    const mEl = measureRef.current;
    if (!mEl || mEl.children.length === 0) return;

    const children = Array.from(mEl.children) as HTMLElement[];
    const totalH = mEl.scrollHeight;

    const blockHeights: number[] = [];
    for (let i = 0; i < children.length; i++) {
      if (i < children.length - 1) {
        blockHeights.push(children[i + 1].offsetTop - children[i].offsetTop);
      } else {
        blockHeights.push(totalH - children[i].offsetTop);
      }
    }

    const key = blockHeights.map(h => Math.round(h)).join(',');
    if (key === prevHeightsRef.current) return;
    prevHeightsRef.current = key;

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

    if (wrapperRef.current) {
      const availW = wrapperRef.current.getBoundingClientRect().width;
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
      {/* Hidden measurement container */}
      <div ref={measureRef} className={s.measureContainer} aria-hidden="true">
        {blocks.map((node, i) => <div key={i}>{node}</div>)}
      </div>

      {/* Rendered A4 pages */}
      {effectivePages.map((indices, pageIdx) => (
        <div
          key={pageIdx}
          className={s.a4PageOuter}
          style={{ width: A4_W * scale, height: A4_H * scale }}
        >
          <div className={s.a4Page} style={{ transform: `scale(${scale})` }}>
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
