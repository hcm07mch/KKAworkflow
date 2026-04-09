'use client';

/**
 * Print-only page for estimate documents.
 * Used by Puppeteer for server-side PDF generation.
 * Renders the EstimatePreview component in a clean, print-ready layout.
 *
 * Important: The #print-ready div is only rendered AFTER data is loaded,
 * so Puppeteer's waitForSelector('#print-ready') waits for actual content.
 */

import { useEffect, useState } from 'react';
import { EstimatePreview } from '@/app/(authenticated)/estimates/estimate-preview';
import type { EstimateContent } from '@/lib/domain/types';

export default function EstimatePrintPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const [data, setData] = useState<EstimateContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ documentId }) => {
      fetch(`/api/documents/${documentId}`, { credentials: 'include' })
        .then((r) => {
          if (!r.ok) throw new Error(`문서 로드 실패 (${r.status})`);
          return r.json();
        })
        .then((doc) => setData(doc.content ?? {}))
        .catch((err) => setError(err.message));
    });
  }, [params]);

  if (error) return <div style={{ color: 'red', padding: 40 }}>Error: {error}</div>;
  if (!data) return <div style={{ padding: 40 }}>로딩 중...</div>;

  return (
    <div
      id="print-ready"
      style={{
        background: '#fff',
        width: 794,
        margin: '0 auto',
      }}
    >
      <EstimatePreview data={data} />
    </div>
  );
}
