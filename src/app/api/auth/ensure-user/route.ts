/**
 * POST /api/auth/ensure-user - 로그인 후 DB 사용자 확인
 *
 * workflow_users에 등록된 사용자만 통과.
 * 미등록 사용자는 접근 거부 (관리자에게 초대 요청 안내).
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

  const serviceClient = createSupabaseServiceClient();

  // workflow_users에 등록 여부 확인
  const { data: existing } = await serviceClient
    .from('workflow_users')
    .select('id, is_active')
    .eq('auth_id', authUser.id)
    .maybeSingle() as { data: { id: string; is_active: boolean } | null };

  if (existing) {
    if (!existing.is_active) {
      return NextResponse.json(
        { error: { code: 'DEACTIVATED', message: '비활성화된 계정입니다. 관리자에게 문의하세요.' } },
        { status: 403 },
      );
    }
    return NextResponse.json({ success: true });
  }

  // workflow_users에 없음 → profiles에 있는지 확인
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('user_id')
    .eq('user_id', authUser.id)
    .maybeSingle() as { data: { user_id: string } | null };

  if (profile) {
    // profiles에는 있지만 초대받지 않은 사용자
    return NextResponse.json(
      { error: { code: 'NOT_INVITED', message: '워크플로우 멤버로 등록되지 않았습니다.\n관리자에게 멤버 초대를 요청하세요.' } },
      { status: 403 },
    );
  }

  // profiles에도 없는 사용자
  return NextResponse.json(
    { error: { code: 'NOT_REGISTERED', message: '등록되지 않은 사용자입니다. 관리자에게 문의하세요.' } },
    { status: 403 },
  );
}