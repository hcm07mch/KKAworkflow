/**
 * API Route: Catalog Category by ID
 * PUT    /api/settings/catalog-categories/[id] → 카테고리 수정
 * DELETE /api/settings/catalog-categories/[id] → 카테고리 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole, requireRootOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const rootCheck = requireRootOrg(auth);
  if (rootCheck) return rootCheck;

  const roleCheck = requireRole(auth.role, 'member');
  if (roleCheck) return roleCheck;

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: '수정할 내용이 없습니다' } },
      { status: 400 },
    );
  }

  const serviceClient = createSupabaseServiceClient();

  const { data, error } = await serviceClient
    .from('workflow_catalog_categories')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
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
      { error: { code: 'UPDATE_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const rootCheck = requireRootOrg(auth);
  if (rootCheck) return rootCheck;

  const roleCheck = requireRole(auth.role, 'member');
  if (roleCheck) return roleCheck;

  const { id } = await params;

  // category_id가 이 카테고리인 카탈로그 항목은 category_id = null 로 처리됨 (ON DELETE SET NULL)
  const serviceClient = createSupabaseServiceClient();
  const { error } = await serviceClient
    .from('workflow_catalog_categories')
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
