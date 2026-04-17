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
      const allowed = await checkUserAllowed(supabase);
      if (!allowed) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=not_invited`);
      }
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

/**
 * workflow_users에 등록된 활성 사용자인지 확인
 */
async function checkUserAllowed(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<boolean> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return false;

  const serviceClient = createSupabaseServiceClient();

  const { data: existing } = await serviceClient
    .from('workflow_users')
    .select('id, is_active')
    .eq('auth_id', authUser.id)
    .maybeSingle() as { data: { id: string; is_active: boolean } | null };

  return existing?.is_active === true;
}