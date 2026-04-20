/**
 * API Route: Settings / Departments (하위 조직)
 * GET  /api/settings/departments → 하위 조직 목록 (workflow_organizations WHERE parent_id = rootOrg)
 * POST /api/settings/departments → 하위 조직 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRootOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { userOrganizationId } = auth;
  const serviceClient = createSupabaseServiceClient();

  const { data, error } = await serviceClient
    .from('workflow_organizations')
    .select('*')
    .eq('parent_id', userOrganizationId)
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

  const { organizationId } = auth;
  const serviceClient = createSupabaseServiceClient();
  const body = await req.json();
  const { name } = body as { name: string };

  // 하위 조직 개수 제한 (최대 3개)
  const { count } = await serviceClient
    .from('workflow_organizations')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', organizationId);

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: { code: 'LIMIT_EXCEEDED', message: '하위 조직은 최대 3개까지 생성할 수 있습니다' } }, { status: 400 });
  }

  if (!name || !name.trim()) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '조직 이름을 입력해주세요' } }, { status: 400 });
  }

  // slug: 부모 slug + 하위 조직명 (URL-safe)
  const { data: parentOrg } = await serviceClient
    .from('workflow_organizations')
    .select('slug')
    .eq('id', organizationId)
    .single();

  const slug = `${parentOrg?.slug ?? 'org'}-${name.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-')}-${Date.now().toString(36)}`;

  const { data, error } = await serviceClient
    .from('workflow_organizations')
    .insert({ name: name.trim(), slug, parent_id: organizationId })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: { code: 'ALREADY_EXISTS', message: '이미 존재하는 조직 이름입니다' } }, { status: 409 });
    }
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
