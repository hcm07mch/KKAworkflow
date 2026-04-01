/**
 * Auth Callback Route
 * GET /auth/callback  ??Supabase OAuth/Magic Link 肄諛?泥由?
 *
 * 1. ?몄? 肄? ???몄 援?
 * 2. public.users ??대?? 誘몃깅????? ???(泥?濡洹??
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/infrastructure/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirectTo') ?? '/';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // 泥?濡洹????users ??대?? ?? ?깅?
      await ensureUserExists(supabase);

      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  // 肄? 援? ?ㅽ???濡洹????댁?濡?由щ?대??
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

/**
 * auth.users ??public.users ?湲??
 *
 * ?대? 議댁?硫?臾댁, 誘몃깅??대?member ??濡????
 * organization_id媛 ?? 寃쎌???泥?踰吏?議곗????? 諛곗.
 * (?ㅻТ????珥? ?濡?곕? ?泥?媛??
 */
async function ensureUserExists(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return;

  // NOTE: @supabase/ssr v0.5.x ?????異濡??supabase-js v2.100+ ? ?명?? ??
  // 荑쇰━ 寃곌낵媛 never濡??댁?? ?ㅼ ?고??????? ????濡?????⑥??ъ?
  // supabase gen types ?? @supabase/ssr ?洹???????嫄?媛??

  // ?대? ?깅????ъ??몄? ???
  const { data: existing } = await supabase
    .from('workflow_users')
    .select('id')
    .eq('auth_id', authUser.id)
    .maybeSingle() as { data: { id: string } | null };

  if (existing) return;

  // 議곗? 議고 (泥?踰吏?議곗???諛곗)
  const { data: org } = await supabase
    .from('workflow_organizations')
    .select('id')
    .limit(1)
    .single() as { data: { id: string } | null };

  if (!org) return; // 議곗?????쇰??깅? 遺?

  await (supabase.from('workflow_users') as any).insert({
    auth_id: authUser.id,
    email: authUser.email!,
    name: authUser.user_metadata?.full_name ?? authUser.email!.split('@')[0],
    organization_id: org.id,
    role: 'member',
  });
}
