/**
 * API Route: Settings / Organization
 * GET /api/settings/org → 조직 정보
 */

import { NextResponse } from 'next/server';
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
