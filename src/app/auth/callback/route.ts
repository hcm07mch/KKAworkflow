/**
 * Auth Callback Route
 * GET /auth/callback - Supabase OAuth/Magic Link 콜백 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/infrastructure/supabase/server';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirectTo') ?? '/';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      await ensureUserExists(supabase);
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

/**
 * auth.users -> workflow_users 동기화
 * 미등록 사용자는 member 역할로 자동 생성
 */
async function ensureUserExists(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return;

  const serviceClient = createSupabaseServiceClient();

  const { data: existing } = await serviceClient
    .from('workflow_users')
    .select('id')
    .eq('auth_id', authUser.id)
    .maybeSingle() as { data: { id: string } | null };

  if (existing) return;

  const { data: org } = await serviceClient
    .from('workflow_organizations')
    .select('id')
    .limit(1)
    .single() as { data: { id: string } | null };

  if (!org) return;

  await (serviceClient.from('workflow_users') as any).insert({
    auth_id: authUser.id,
    email: authUser.email!,
    name: authUser.user_metadata?.full_name ?? authUser.email!.split('@')[0],
    organization_id: org.id,
    role: 'member',
  });
}