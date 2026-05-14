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
  // 본사(root) 계정은 활성 스코프와 무관하게 본사+모든 지사 문의를 볼 수 있어야 함
  // (지사로 이전된 문의를 다시 가져오는 운영 작업 포함)
  const visibleOrgIds = auth.isRootOrg ? auth.fullAllowedOrgIds : auth.allowedOrgIds;
  let query = serviceClient
    .from('landing_inquiries')
    .select('*')
    .in('organization_id', visibleOrgIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status && (ALLOWED_STATUSES as readonly string[]).includes(status)) {
    query = query.eq('status', status);
  }

  if (q) {
    // ilike OR 검색
    const escaped = q.replace(/[%,]/g, ' ');
    query = query.or(
      `name.ilike.%${escaped}%,phone.ilike.%${escaped}%,industry.ilike.%${escaped}%,region.ilike.%${escaped}%,message.ilike.%${escaped}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: { code: 'QUERY_FAILED', message: error.message } }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/landing-inquiries
 *   - 본사 운영자가 수동으로 문의를 등록할 때 사용
 *   - 필수: phone
 *   - 선택: name, industry, region, message, source(기본 'manual'), admin_note
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  if (!auth.isRootOrg) {
    return NextResponse.json(
      { error: { code: 'ROOT_ORG_ONLY', message: '본사 계정만 접근 가능합니다' } },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));

  const phoneRaw = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!phoneRaw) {
    return NextResponse.json(
      { error: { code: 'PHONE_REQUIRED', message: '연락처는 필수입니다' } },
      { status: 400 },
    );
  }

  const norm = (v: unknown) => {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    return s.length > 0 ? s : null;
  };

  const insert: Record<string, unknown> = {
    phone: phoneRaw,
    name: norm(body.name),
    industry: norm(body.industry),
    region: norm(body.region),
    message: norm(body.message),
    admin_note: norm(body.admin_note),
    source: norm(body.source) ?? 'manual',
    status: 'new',
    organization_id: auth.rootOrganizationId,
  };

  const serviceClient = createSupabaseServiceClient();
  const { data, error } = await serviceClient
    .from('landing_inquiries')
    .insert(insert)
    .select()
    .single();

  if (error || !data) {
    console.error('[landing-inquiries POST] insert failed', { insert, error });
    return NextResponse.json(
      {
        error: {
          code: 'INSERT_FAILED',
          message: error?.message ?? '문의 등록에 실패했습니다',
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
