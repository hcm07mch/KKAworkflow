/**
 * API Route: Service Catalog CRUD
 * GET  /api/settings/catalogs               → 카탈로그 목록 (query: type=estimate|execution)
 * POST /api/settings/catalogs               → 카탈로그 항목 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);
  const catalogType = searchParams.get('type'); // 'estimate' | 'execution' | null (all)

  let query = auth.supabase
    .from('workflow_service_catalog')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .order('sort_order', { ascending: true });

  if (catalogType) {
    query = query.eq('catalog_type', catalogType);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: { code: 'FETCH_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const roleCheck = requireRole(auth.role, 'manager');
  if (roleCheck) return roleCheck;

  const body = await request.json();

  const { data, error } = await auth.supabase
    .from('workflow_service_catalog')
    .insert({
      organization_id: auth.organizationId,
      catalog_type: body.catalog_type,
      group_name: body.group_name,
      name: body.name,
      sort_order: body.sort_order ?? 0,
      base_price: body.base_price ?? 0,
      content: body.content ?? {},
      is_active: body.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: 'CREATE_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
