/**
 * API Route: Landing Inquiries
 * GET /api/landing-inquiries
 *   - 랜딩페이지 문의 목록 조회 (admin 전용)
 *   - 쿼리 파라미터: status, q (이름/연락처/메시지 검색), limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

const ALLOWED_STATUSES = ['new', 'contacted', 'closed', 'spam'] as const;

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const roleError = requireRole(auth.role, 'admin');
  if (roleError) return roleError;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const q = searchParams.get('q')?.trim();
  const limitParam = searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam ?? '200', 10) || 200, 1), 500);

  const serviceClient = createSupabaseServiceClient();
  let query = serviceClient
    .from('landing_inquiries')
    .select('*')
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
