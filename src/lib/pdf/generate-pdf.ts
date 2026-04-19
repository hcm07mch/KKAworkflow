/**
 * PDF Generation Utility (shared)
 *
 * Puppeteer로 견적서 인쇄 페이지를 렌더링하여 PDF를 생성하고
 * Supabase Storage에 업로드한 뒤 결과를 반환합니다.
 *
 * 최적화:
 *  - 브라우저 인스턴스 재사용 (warm invocation)
 *  - 이미지/미디어 리소스 차단으로 페이지 로드 가속
 */

import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase';
import type { Browser } from 'puppeteer-core';

/* ── 모듈-레벨 브라우저 캐시 (warm invocation 재사용) ── */
let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) {
    return _browser;
  }

  const puppeteer = await import('puppeteer-core');

  let executablePath: string;
  let launchArgs: string[];

  if (process.env.CHROMIUM_PATH) {
    executablePath = process.env.CHROMIUM_PATH;
    launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ];
  } else {
    const chromium = (await import('@sparticuz/chromium')).default;
    chromium.setGraphicsMode = false;
    executablePath = await chromium.executablePath();
    launchArgs = chromium.args;
  }

  console.log('[pdf] Launching browser:', executablePath);

  _browser = await puppeteer.default.launch({
    args: launchArgs,
    defaultViewport: { width: 794, height: 1123 },
    executablePath,
    headless: true,
  });

  return _browser;
}

export interface GeneratePdfParams {
  documentId: string;
  organizationId: string;
  origin: string;
  cookieHeader: string;
  existingMetadata?: Record<string, unknown>;
}

export interface GeneratePdfResult {
  success: true;
  url: string;
  path: string;
}

export interface GeneratePdfError {
  success: false;
  code: string;
  message: string;
}

interface DocumentRepo {
  update(id: string, data: Record<string, unknown>): Promise<unknown>;
}

export async function generatePdf(
  params: GeneratePdfParams,
  documentRepo: DocumentRepo,
): Promise<GeneratePdfResult | GeneratePdfError> {
  const { documentId, organizationId, origin, cookieHeader, existingMetadata } = params;

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // 불필요한 리소스 차단
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (type === 'image' || type === 'media') {
        req.abort();
      } else {
        req.continue();
      }
    });

    const printUrl = `${origin}/print/estimates/${documentId}`;

    // 쿠키 전달 (인증 유지)
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map((c) => {
        const [name, ...rest] = c.trim().split('=');
        return {
          name: name.trim(),
          value: rest.join('=').trim(),
          domain: new URL(origin).hostname,
          path: '/',
        };
      });
      await page.setCookie(...cookies);
    }

    console.log('[pdf] Navigating to:', printUrl);
    await page.goto(printUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#print-ready', { timeout: 15000 });
    await page.evaluateHandle('document.fonts.ready');

    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    await page.close();
    page = null;

    const pdfBuffer = Buffer.from(pdfUint8);
    console.log('[pdf] PDF generated, size:', pdfBuffer.length, 'bytes');

    if (pdfBuffer.length === 0) {
      return { success: false, code: 'EMPTY_PDF', message: 'PDF가 비어 있습니다.' };
    }

    // Supabase Storage에 업로드
    const serviceClient = createSupabaseServiceClient();
    const filePath = `${organizationId}/${documentId}/estimate_${documentId}.pdf`;

    const { error: uploadError } = await serviceClient.storage
      .from('project-documents')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('[pdf] Storage upload error:', uploadError);
      return { success: false, code: 'UPLOAD_FAILED', message: uploadError.message };
    }

    // 문서 metadata에 PDF 경로 기록
    const meta = { ...(existingMetadata ?? {}), pdf_path: filePath };
    await documentRepo.update(documentId, { metadata: meta });

    // signed URL 반환 (5분 유효)
    const { data, error: signError } = await serviceClient.storage
      .from('project-documents')
      .createSignedUrl(filePath, 300);

    if (signError || !data?.signedUrl) {
      return { success: false, code: 'STORAGE_ERROR', message: signError?.message ?? 'URL 생성 실패' };
    }

    return { success: true, url: data.signedUrl, path: filePath };
  } catch (err) {
    console.error('[pdf] Unhandled error:', err);
    _browser = null;
    return {
      success: false,
      code: 'PDF_GENERATION_FAILED',
      message: err instanceof Error ? err.message : 'PDF 생성 실패',
    };
  } finally {
    if (page && !page.isClosed()) {
      try { await page.close(); } catch { /* ignore */ }
    }
  }
}
