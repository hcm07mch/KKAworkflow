/**
 * API Route: Settings / Member Invite Candidates
 * GET /api/settings/members/candidates → profiles 중 초대 가능한 유저 목록
 *
 * profiles.tier_code IN ('admin', 'manager', 'branch') 이면서
 * workflow_users에 아직 없는 유저들만 반환
 */

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  if (auth.role !== 'admin' && auth.role !== 'manager') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: '권한이 없습니다' } }, { status: 403 });
  }

  const { organizationId } = auth;
  const serviceClient = createSupabaseServiceClient();

  // 1. 이미 등록된 auth_id 목록 (루트 + 하위 조직 전체)
  const { data: children } = await serviceClient
    .from('workflow_organizations')
    .select('id')
    .eq('parent_id', organizationId);
  const orgIds = [organizationId, ...(children ?? []).map((c: { id: string }) => c.id)];

  const { data: existingUsers } = await serviceClient
    .from('workflow_users')
    .select('auth_id')
    .in('organization_id', orgIds)
    .not('auth_id', 'is', null);

  const existingAuthIds = new Set((existingUsers ?? []).map((u: { auth_id: string }) => u.auth_id));

  // 2. profiles에서 admin/manager/branch 티어 유저 조회
  const { data: profiles, error } = await serviceClient
    .from('profiles')
    .select('user_id, display_name, email, company_name, tier_code')
    .in('tier_code', ['admin', 'manager', 'branch'])
    .eq('is_kicked', false);

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }

  // 3. 이미 등록된 유저 제외
  const candidates = (profiles ?? [])
    .filter((p: { user_id: string }) => !existingAuthIds.has(p.user_id))
    .map((p: { user_id: string; display_name: string | null; email: string | null; company_name: string | null; tier_code: string }) => ({
      authId: p.user_id,
      name: p.display_name || p.company_name || p.email?.split('@')[0] || '(이름 없음)',
      email: p.email || '',
      tierCode: p.tier_code,
    }));

  return NextResponse.json(candidates);
}
