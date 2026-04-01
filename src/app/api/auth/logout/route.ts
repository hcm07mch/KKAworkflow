/**
 * POST /api/auth/logout ? 濡洹몄? 泥由?
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/infrastructure/supabase/server';

export async function POST() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}
