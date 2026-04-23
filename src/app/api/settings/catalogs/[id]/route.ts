/**
 * API Route: Service Catalog Item CRUD
 * GET    /api/settings/catalogs/[id]        → 단일 카탈로그 항목 조회
 * PUT    /api/settings/catalogs/[id]        → 카탈로그 항목 수정
 * DELETE /api/settings/catalogs/[id]        → 카탈로그 항목 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole, requireRootOrg } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;

  const { data, error } = await auth.supabase
    .from('workflow_service_catalog')
    .select('*')
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '카탈로그 항목을 찾을 수 없습니다' } },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const rootCheck = requireRootOrg(auth);
  if (rootCheck) return rootCheck;

  const roleCheck = requireRole(auth.role, 'member');
  if (roleCheck) return roleCheck;

  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {};
  if (body.group_name !== undefined) updateData.group_name = body.group_name;
  if (body.category_id !== undefined) updateData.category_id = body.category_id || null;
  if (body.name !== undefined) updateData.name = body.name;
  if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;
  if (body.base_price !== undefined) updateData.base_price = body.base_price;
  if (body.content !== undefined) updateData.content = body.content;
  if (body.is_active !== undefined) updateData.is_active = body.is_active;
  updateData.updated_at = new Date().toISOString();

  const { data, error } = await auth.supabase
    .from('workflow_service_catalog')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: 'UPDATE_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const rootCheck = requireRootOrg(auth);
  if (rootCheck) return rootCheck;

  const roleCheck = requireRole(auth.role, 'member');
  if (roleCheck) return roleCheck;

  const { id } = await params;

  const { error } = await auth.supabase
    .from('workflow_service_catalog')
    .delete()
    .eq('id', id)
    .eq('organization_id', auth.organizationId);

  if (error) {
    return NextResponse.json(
      { error: { code: 'DELETE_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
