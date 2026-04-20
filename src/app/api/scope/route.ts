/**
 * API Route: Scope Switcher (본사/지사 전환)
 * GET  /api/scope  → 현재 스코프 + 전환 가능한 조직 목록
 * POST /api/scope  → body: { orgId: string | null } 스코프 쿠키 설정
 *
 * 본사(루트) 계정만 사용 가능. 하위 조직 계정은 항상 자기 조직 스코프로 고정.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthContext } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

const COOKIE_NAME = 'active-scope';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const serviceClient = createSupabaseServiceClient();
  const { data: orgs } = await serviceClient
    .from('workflow_organizations')
    .select('id, name, parent_id')
    .in('id', auth.fullAllowedOrgIds);

  return NextResponse.json({
    isRootOrg: auth.isRootOrg,
    activeScope: auth.activeScope, // null이면 전체(본사+지사)
    orgs: (orgs ?? []).sort((a, b) => {
      // 루트 조직(parent_id null)이 먼저
      if (!a.parent_id && b.parent_id) return -1;
      if (a.parent_id && !b.parent_id) return 1;
      return a.name.localeCompare(b.name);
    }),
  });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  if (!auth.isRootOrg) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '본사 계정만 스코프를 전환할 수 있습니다' } },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const orgId: string | null = body.orgId ?? null;

  const cookieStore = await cookies();

  if (orgId === null) {
    cookieStore.delete(COOKIE_NAME);
    return NextResponse.json({ activeScope: null });
  }

  if (!auth.fullAllowedOrgIds.includes(orgId)) {
    return NextResponse.json(
      { error: { code: 'INVALID_SCOPE', message: '허용되지 않는 조직입니다' } },
      { status: 403 },
    );
  }

  cookieStore.set(COOKIE_NAME, orgId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30일
  });

  return NextResponse.json({ activeScope: orgId });
}
