/**
 * API Route: Generate PDF (Server-side)
 * POST /api/documents/:documentId/pdf/generate
 *
 * Puppeteer로 견적서 인쇄 페이지를 렌더링하여 PDF를 생성하고
 * Supabase Storage에 업로드한 뒤 signed URL을 반환합니다.
 *
 * 환경 변수:
 *  - CHROMIUM_PATH: 로컬 개발용 Chrome/Chromium 경로 (Windows 등)
 *    예: C:\Program Files\Google\Chrome\Application\chrome.exe
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase';

export const maxDuration = 60; // Vercel serverless timeout (초)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { documentId } = await params;

  const doc = await auth.services.documentRepo.findById(documentId);
  if (!doc) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '문서를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }

  let browser;
  try {
    const puppeteer = await import('puppeteer-core');

    // ── 환경별 Chromium 실행 경로 결정 ──
    let executablePath: string;
    let launchArgs: string[];

    if (process.env.CHROMIUM_PATH) {
      // 로컬 개발: 설치된 Chrome/Chromium 사용
      executablePath = process.env.CHROMIUM_PATH;
      launchArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ];
    } else {
      // 프로덕션/서버리스: @sparticuz/chromium 사용
      const chromium = await import('@sparticuz/chromium');
      executablePath = await chromium.default.executablePath();
      launchArgs = chromium.default.args;
    }

    console.log('[pdf/generate] Launching browser:', executablePath);

    browser = await puppeteer.default.launch({
      args: launchArgs,
      defaultViewport: { width: 1200, height: 800 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();

    // 요청에서 origin을 추출하여 인쇄 페이지 URL 구성
    const origin = request.nextUrl.origin;
    const printUrl = `${origin}/print/estimates/${documentId}`;

    // 쿠키 전달 (인증 유지)
    const cookieHeader = request.headers.get('cookie') ?? '';
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

    // 인쇄 페이지 방문 & 렌더링 대기
    console.log('[pdf/generate] Navigating to:', printUrl);
    await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('#print-ready', { timeout: 15000 });

    // A4 PDF 생성
    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    await browser.close();
    browser = null;

    // Uint8Array → Buffer 변환 (Supabase Storage 업로드 호환성)
    const pdfBuffer = Buffer.from(pdfUint8);
    console.log('[pdf/generate] PDF generated, size:', pdfBuffer.length, 'bytes');

    if (pdfBuffer.length === 0) {
      return NextResponse.json(
        { error: { code: 'EMPTY_PDF', message: 'PDF가 비어 있습니다. 페이지 렌더링을 확인하세요.' } },
        { status: 500 },
      );
    }

    // Supabase Storage에 업로드
    const serviceClient = createSupabaseServiceClient();
    const filePath = `${auth.organizationId}/${documentId}/estimate_${documentId}.pdf`;

    const { error: uploadError } = await serviceClient.storage
      .from('project-documents')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('[pdf/generate] Storage upload error:', uploadError);
      return NextResponse.json(
        { error: { code: 'UPLOAD_FAILED', message: uploadError.message } },
        { status: 500 },
      );
    }

    // 문서 metadata에 PDF 경로 기록
    const existingMeta = (doc.metadata as Record<string, unknown>) ?? {};
    await auth.services.documentRepo.update(documentId, {
      metadata: { ...existingMeta, pdf_path: filePath },
    });

    // signed URL 반환 (5분 유효)
    const { data, error: signError } = await serviceClient.storage
      .from('project-documents')
      .createSignedUrl(filePath, 300);

    if (signError || !data?.signedUrl) {
      return NextResponse.json(
        { error: { code: 'STORAGE_ERROR', message: signError?.message ?? 'URL 생성 실패' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: data.signedUrl, path: filePath });
  } catch (err) {
    console.error('[pdf/generate] Unhandled error:', err);
    return NextResponse.json(
      { error: { code: 'PDF_GENERATION_FAILED', message: err instanceof Error ? err.message : 'PDF 생성 실패' } },
      { status: 500 },
    );
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}
