/**
 * API Route: Documents (org-wide)
 * GET /api/documents?type=estimate|contract|pre_report|report
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { supabase, organizationId } = auth;
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type');

  let query = supabase
    .from('workflow_project_documents')
    .select(
      '*, project:workflow_projects!inner(id, title, organization_id, service_type, total_amount, start_date, end_date, status, client:workflow_clients(id, name))',
    )
    .eq('project.organization_id', organizationId);

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json(data ?? []);
}
