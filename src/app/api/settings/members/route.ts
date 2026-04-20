/**
 * API Route: Settings / Members
 * GET  /api/settings/members → 조직 멤버 목록 (루트 조직 + 하위 조직 전체)
 * POST /api/settings/members → 멤버 초대 (profiles → workflow_users)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRootOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

/** 루트 조직 + 하위 조직 ID 목록 조회 */
async function getOrgIds(serviceClient: ReturnType<typeof createSupabaseServiceClient>, rootOrgId: string) {
  const { data: children } = await serviceClient
    .from('workflow_organizations')
    .select('id')
    .eq('parent_id', rootOrgId);
  return [rootOrgId, ...(children ?? []).map((c: { id: string }) => c.id)];
}

export async function GET() {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const serviceClient = createSupabaseServiceClient();

  const { data, error } = await serviceClient
    .from('workflow_users')
    .select('*')
    .in('organization_id', auth.allowedOrgIds)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const rootErr = requireRootOrg(auth);
  if (rootErr) return rootErr;

  if (auth.role !== 'admin' && auth.role !== 'manager') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: '권한이 없습니다' } }, { status: 403 });
  }

  const { userOrganizationId } = auth;
  const body = await req.json();
  const { authId, role, subOrgId } = body as { authId: string; role: string; subOrgId?: string };

  if (!authId || !['admin', 'manager', 'member'].includes(role)) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '잘못된 요청입니다' } }, { status: 400 });
  }

  const serviceClient = createSupabaseServiceClient();

  // 하위 조직 ID 검증
  let targetOrgId = userOrganizationId;
  if (subOrgId) {
    const { data: subOrg } = await serviceClient
      .from('workflow_organizations')
      .select('id')
      .eq('id', subOrgId)
      .eq('parent_id', userOrganizationId)
      .single();
    if (subOrg) targetOrgId = subOrg.id;
  }

  // 1. profiles에서 유저 정보 조회
  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('user_id, display_name, email, company_name')
    .eq('user_id', authId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: '유저를 찾을 수 없습니다' } }, { status: 404 });
  }

  // 2. 이미 등록 여부 확인 (전체 조직 범위)
  const orgIds = await getOrgIds(serviceClient, userOrganizationId);
  const { data: existing } = await serviceClient
    .from('workflow_users')
    .select('id')
    .eq('auth_id', authId)
    .in('organization_id', orgIds)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: { code: 'ALREADY_EXISTS', message: '이미 등록된 멤버입니다' } }, { status: 409 });
  }

  // 3. workflow_users에 추가
  const name = profile.display_name || profile.company_name || profile.email?.split('@')[0] || '(이름 없음)';

  const { data: newUser, error: insertError } = await serviceClient
    .from('workflow_users')
    .insert({
      auth_id: authId,
      organization_id: targetOrgId,
      email: profile.email || '',
      name,
      role,
      is_active: true,
    })
    .select('*')
    .single();

  if (insertError) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: insertError.message } }, { status: 500 });
  }

  return NextResponse.json(newUser, { status: 201 });
}
