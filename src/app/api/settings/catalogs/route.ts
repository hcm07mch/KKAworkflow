/**
 * API Route: Service Catalog CRUD
 * GET   /api/settings/catalogs               → 카탈로그 목록 (query: type=estimate|execution)
 * POST  /api/settings/catalogs               → 카탈로그 항목 생성
 * PATCH /api/settings/catalogs               → 일괄 정렬 (body: { orders: [{ id, sort_order }] })
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole, requireRootOrg } from '@/lib/auth';

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

  const rootCheck = requireRootOrg(auth);
  if (rootCheck) return rootCheck;

  const roleCheck = requireRole(auth.role, 'member');
  if (roleCheck) return roleCheck;

  const body = await request.json();

  const { data, error } = await auth.supabase
    .from('workflow_service_catalog')
    .insert({
      organization_id: auth.organizationId,
      catalog_type: body.catalog_type,
      group_name: body.group_name,
      category_id: body.category_id || null,
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

export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const rootCheck = requireRootOrg(auth);
  if (rootCheck) return rootCheck;

  const roleCheck = requireRole(auth.role, 'member');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const orders: Array<{ id: string; sort_order: number }> = body.orders;

  if (!Array.isArray(orders) || orders.length === 0) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: '정렬 데이터가 필요합니다' } },
      { status: 400 },
    );
  }

  const results = await Promise.all(
    orders.map(({ id, sort_order }) =>
      auth.supabase
        .from('workflow_service_catalog')
        .update({ sort_order })
        .eq('id', id)
        .eq('organization_id', auth.organizationId),
    ),
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return NextResponse.json(
      { error: { code: 'REORDER_FAILED', message: failed.error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
