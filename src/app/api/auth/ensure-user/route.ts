/**
 * POST /api/auth/ensure-user - 로그인 후 DB 사용자 동기화
 *
 * Password 로그인 후 workflow_users 테이블에 사용자가 없으면 자동 생성.
 * profiles 테이블이 있으면 기존 정보(역할, 이름 등)를 반영합니다.
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/infrastructure/supabase/server';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

export async function POST() {
  const supabase = await createSupabaseServerClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다' } },
      { status: 401 },
    );
  }

  // Service role client (RLS 우회 - 신규 사용자는 RLS로 자기 자신 INSERT 불가)
  const serviceClient = createSupabaseServiceClient();

  // 이미 등록된 사용자인지 확인
  const { data: existing } = await serviceClient
    .from('workflow_users')
    .select('id')
    .eq('auth_id', authUser.id)
    .maybeSingle() as { data: { id: string } | null };

  if (existing) {
    return NextResponse.json({ success: true, created: false });
  }

  // 조직 조회 (첫 번째 조직을 배정)
  const { data: org } = await serviceClient
    .from('workflow_organizations')
    .select('id')
    .limit(1)
    .single() as { data: { id: string } | null };

  if (!org) {
    return NextResponse.json(
      { error: { code: 'NO_ORGANIZATION', message: '등록된 조직이 없습니다' } },
      { status: 400 },
    );
  }

  // profiles 테이블에서 기존 유저 정보 조회
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('display_name, email, tier_code, is_kicked, business_owner_name, company_name')
    .eq('user_id', authUser.id)
    .maybeSingle() as {
      data: {
        display_name: string | null;
        email: string | null;
        tier_code: string;
        is_kicked: boolean;
        business_owner_name: string | null;
        company_name: string | null;
      } | null;
    };

  const tierToRole: Record<string, string> = {
    admin: 'admin',
    manager: 'manager',
    branch: 'member',
  };
  const role = profile ? (tierToRole[profile.tier_code] ?? 'member') : 'member';
  const name = profile?.display_name
    ?? profile?.business_owner_name
    ?? profile?.company_name
    ?? authUser.user_metadata?.full_name
    ?? authUser.email!.split('@')[0];

  await (serviceClient.from('workflow_users') as any).insert({
    auth_id: authUser.id,
    email: profile?.email ?? authUser.email!,
    name,
    organization_id: org.id,
    role,
    is_active: profile ? !profile.is_kicked : true,
  });

  return NextResponse.json({ success: true, created: true });
}