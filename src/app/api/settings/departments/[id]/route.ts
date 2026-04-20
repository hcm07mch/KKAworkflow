/**
 * API Route: Settings / Departments / [id] (하위 조직)
 * PUT    /api/settings/departments/:id → 하위 조직 수정
 * DELETE /api/settings/departments/:id → 하위 조직 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRootOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const rootErr = requireRootOrg(auth);
  if (rootErr) return rootErr;

  if (auth.role !== 'admin' && auth.role !== 'manager') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: '권한이 없습니다' } }, { status: 403 });
  }

  const { id } = await params;
  const { organizationId } = auth;
  const serviceClient = createSupabaseServiceClient();
  const body = await req.json();
  const { name } = body as { name: string };

  if (!name || !name.trim()) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '조직 이름을 입력해주세요' } }, { status: 400 });
  }

  const { data, error } = await serviceClient
    .from('workflow_organizations')
    .update({ name: name.trim() })
    .eq('id', id)
    .eq('parent_id', organizationId)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: { code: 'ALREADY_EXISTS', message: '이미 존재하는 조직 이름입니다' } }, { status: 409 });
    }
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: '조직을 찾을 수 없습니다' } }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const rootErr = requireRootOrg(auth);
  if (rootErr) return rootErr;

  if (auth.role !== 'admin' && auth.role !== 'manager') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: '권한이 없습니다' } }, { status: 403 });
  }

  const { id } = await params;
  const { organizationId } = auth;
  const serviceClient = createSupabaseServiceClient();

  // 삭제 전: 소속 멤버를 루트 조직으로 복귀
  await serviceClient
    .from('workflow_users')
    .update({ organization_id: organizationId })
    .eq('organization_id', id);

  const { error } = await serviceClient
    .from('workflow_organizations')
    .delete()
    .eq('id', id)
    .eq('parent_id', organizationId);

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
