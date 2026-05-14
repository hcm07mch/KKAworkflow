/**
 * API Route: Landing Inquiries
 * GET /api/landing-inquiries
 *   - 랜딩페이지 문의 목록 조회
 *   - 본사 계정: 활성 스코프(allowedOrgIds) 기준으로 조회
 *   - 지사 계정: 본인 조직(allowedOrgIds)으로 이관(handover)된 문의만 조회
 *   - 쿼리 파라미터: status, q (이름/연락처/메시지 검색), limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

const ALLOWED_STATUSES = ['new', 'contacted', 'closed', 'spam'] as const;

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const q = searchParams.get('q')?.trim();
  const limitParam = searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam ?? '200', 10) || 200, 1), 500);

  const serviceClient = createSupabaseServiceClient();
  let query = serviceClient
    .from('landing_inquiries')
    .select('*')
    .in('organization_id', auth.allowedOrgIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status && (ALLOWED_STATUSES as readonly string[]).includes(status)) {
    query = query.eq('status', status);
  }

  if (q) {
    // ilike OR 검색
    const escaped = q.replace(/[%,]/g, ' ');
    query = query.or(
      `name.ilike.%${escaped}%,phone.ilike.%${escaped}%,industry.ilike.%${escaped}%,message.ilike.%${escaped}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: { code: 'QUERY_FAILED', message: error.message } }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
