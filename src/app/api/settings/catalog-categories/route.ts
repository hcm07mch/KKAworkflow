/**
 * API Route: Catalog Categories
 * GET   /api/settings/catalog-categories        → 카테고리 목록 (query: type=estimate|execution)
 * POST  /api/settings/catalog-categories        → 카테고리 생성
 * PATCH /api/settings/catalog-categories        → 카테고리 일괄 정렬 (body: { orders: [{ id, sort_order }] })
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole, requireRootOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const serviceClient = createSupabaseServiceClient();
  const { searchParams } = new URL(request.url);
  const catalogType = searchParams.get('type');

  let query = serviceClient
    .from('workflow_catalog_categories')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

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

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: '카테고리명을 입력하세요' } },
      { status: 400 },
    );
  }

  const serviceClient = createSupabaseServiceClient();

  const { data, error } = await serviceClient
    .from('workflow_catalog_categories')
    .insert({
      organization_id: auth.organizationId,
      catalog_type: body.catalog_type,
      name: body.name.trim(),
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: { code: 'DUPLICATE', message: '이미 존재하는 카테고리명입니다' } },
        { status: 409 },
      );
    }
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

  const serviceClient = createSupabaseServiceClient();
  const results = await Promise.all(
    orders.map(({ id, sort_order }) =>
      serviceClient
        .from('workflow_catalog_categories')
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
