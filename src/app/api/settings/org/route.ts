/**
 * API Route: Settings / Organization
 * GET  /api/settings/org → 조직 정보
 * PATCH /api/settings/org → 조직 설정 업데이트 (settings JSONB)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRootOrg } from '@/lib/auth';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { supabase, userOrganizationId } = auth;

  const { data, error } = await supabase
    .from('workflow_organizations')
    .select('*')
    .eq('id', userOrganizationId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Organization not found' } },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const rootErr = requireRootOrg(auth);
  if (rootErr) return rootErr;

  if (auth.role !== 'admin' && auth.role !== 'manager') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: '권한이 없습니다' } }, { status: 403 });
  }

  const { supabase, userOrganizationId } = auth;
  const body = await req.json();

  const updatePayload: Record<string, unknown> = {};

  // 조직명 변경
  if (body.name && typeof body.name === 'string' && body.name.trim()) {
    updatePayload.name = body.name.trim();
  }

  // settings JSONB 병합
  if (body.settings) {
    const { data: current } = await supabase
      .from('workflow_organizations')
      .select('settings')
      .eq('id', userOrganizationId)
      .single();

    updatePayload.settings = { ...(current?.settings ?? {}), ...body.settings };
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '변경할 항목이 없습니다' } }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('workflow_organizations')
    .update(updatePayload)
    .eq('id', userOrganizationId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: { code: 'UPDATE_FAILED', message: error.message } }, { status: 500 });
  }

  return NextResponse.json(data);
}
