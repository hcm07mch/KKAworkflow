'use client';

/**
 * Print-only page for documents (estimate / pre_report 등).
 * Used by Puppeteer for server-side PDF generation.
 *
 * 문서 type에 따라 적절한 Preview 컴포넌트를 렌더링합니다.
 *  - estimate           → EstimatePreview
 *  - pre_report (진행안) → CampaignPlanPreview
 *
 * Important: The #print-ready div is only rendered AFTER data is loaded,
 * so Puppeteer's waitForSelector('#print-ready') waits for actual content.
 */

import { useEffect, useState } from 'react';
import { EstimatePreview } from '@/app/(authenticated)/estimates/estimate-preview';
import { CampaignPlanPreview } from '@/app/(authenticated)/executions/campaign-plan-preview';
import type { EstimateContent, PreReportContent, DocumentType } from '@/lib/domain/types';

interface DocPayload {
  type: DocumentType;
  content: EstimateContent | PreReportContent | Record<string, unknown>;
}

export default function EstimatePrintPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const [doc, setDoc] = useState<DocPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ documentId }) => {
      fetch(`/api/documents/${documentId}`, { credentials: 'include' })
        .then((r) => {
          if (!r.ok) throw new Error(`문서 로드 실패 (${r.status})`);
          return r.json();
        })
        .then((d) => setDoc({ type: d.type, content: d.content ?? {} }))
        .catch((err) => setError(err.message));
    });
  }, [params]);

  if (error) return <div style={{ color: 'red', padding: 40 }}>Error: {error}</div>;
  if (!doc) return <div style={{ padding: 40 }}>로딩 중...</div>;

  return (
    <div
      id="print-ready"
      style={{
        background: '#fff',
        width: 794,
        margin: '0 auto',
      }}
    >
      {doc.type === 'pre_report' ? (
        <CampaignPlanPreview data={doc.content as PreReportContent} />
      ) : (
        <EstimatePreview data={doc.content as EstimateContent} />
      )}
    </div>
  );
}
