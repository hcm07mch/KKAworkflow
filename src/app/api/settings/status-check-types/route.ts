import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { data, error } = await auth.supabase
    .from('workflow_status_check_types')
    .select('status, check_type');

  if (error) {
    return NextResponse.json({ error: { code: 'FETCH_ERROR', message: error.message } }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
