/**
 * POST /api/auth/ensure-user ? 濡洹몄?? DB ?ъ⑹ ?湲고
 *
 * Password 濡洹몄?? workflow_users ??대?? ?ъ⑹媛 ??쇰㈃ ?? ???
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/infrastructure/supabase/server';

export async function POST() {
  const supabase = await createSupabaseServerClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: '?몄??????⑸??' } },
      { status: 401 },
    );
  }

  // ?대??깅?? ?ъ⑹?몄? ???
  const { data: existing } = await supabase
    .from('workflow_users')
    .select('id')
    .eq('auth_id', authUser.id)
    .maybeSingle() as { data: { id: string } | null };

  if (existing) {
    return NextResponse.json({ success: true, created: false });
  }

  // 議곗? 議고 (泥?踰吏?議곗?? 諛곗)
  const { data: org } = await supabase
    .from('workflow_organizations')
    .select('id')
    .limit(1)
    .single() as { data: { id: string } | null };

  if (!org) {
    return NextResponse.json(
      { error: { code: 'NO_ORGANIZATION', message: '?깅?? 議곗?????듬??' } },
      { status: 400 },
    );
  }

  await (supabase.from('workflow_users') as any).insert({
    auth_id: authUser.id,
    email: authUser.email!,
    name: authUser.user_metadata?.full_name ?? authUser.email!.split('@')[0],
    organization_id: org.id,
    role: 'member',
  });

  return NextResponse.json({ success: true, created: true });
}
