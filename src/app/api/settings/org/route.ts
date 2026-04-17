/**
 * API Route: Settings / Organization
 * GET  /api/settings/org → 조직 정보
 * PATCH /api/settings/org → 조직 설정 업데이트 (settings JSONB)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { supabase, organizationId } = auth;

  const { data, error } = await supabase
    .from('workflow_organizations')
    .select('*')
    .eq('id', organizationId)
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

  if (auth.role !== 'admin' && auth.role !== 'manager') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: '권한이 없습니다' } }, { status: 403 });
  }

  const { supabase, organizationId } = auth;
  const body = await req.json();

  // Merge into existing settings
  const { data: current } = await supabase
    .from('workflow_organizations')
    .select('settings')
    .eq('id', organizationId)
    .single();

  const merged = { ...(current?.settings ?? {}), ...body.settings };

  const { data, error } = await supabase
    .from('workflow_organizations')
    .update({ settings: merged })
    .eq('id', organizationId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: { code: 'UPDATE_FAILED', message: error.message } }, { status: 500 });
  }

  return NextResponse.json(data);
}
