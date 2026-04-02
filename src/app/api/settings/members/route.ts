/**
 * API Route: Settings / Members
 * GET /api/settings/members → 조직 멤버 목록
 */

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { supabase, organizationId } = auth;

  const { data, error } = await supabase
    .from('workflow_users')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json(data ?? []);
}
