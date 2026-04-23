/**
 * API Route: Catalog Links (견적↔집행 연결)
 * GET  /api/settings/catalogs/links         → 전체 링크 목록
 * POST /api/settings/catalogs/links         → 링크 생성
 *
 * Query params:
 *   ?estimate_id=UUID  → 특정 견적 카탈로그에 연결된 집행 항목 조회
 *   ?execution_id=UUID → 특정 집행 카탈로그에 연결된 견적 항목 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole, requireRootOrg } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);
  const estimateId = searchParams.get('estimate_id');
  const executionId = searchParams.get('execution_id');

  let query = auth.supabase
    .from('workflow_catalog_links')
    .select(`
      *,
      estimate_catalog:workflow_service_catalog!estimate_catalog_id(*),
      execution_catalog:workflow_service_catalog!execution_catalog_id(*)
    `)
    .eq('organization_id', auth.organizationId);

  if (estimateId) {
    query = query.eq('estimate_catalog_id', estimateId);
  }
  if (executionId) {
    query = query.eq('execution_catalog_id', executionId);
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

  if (!body.estimate_catalog_id || !body.execution_catalog_id) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'estimate_catalog_id와 execution_catalog_id가 필요합니다' } },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from('workflow_catalog_links')
    .insert({
      organization_id: auth.organizationId,
      estimate_catalog_id: body.estimate_catalog_id,
      execution_catalog_id: body.execution_catalog_id,
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

export async function DELETE(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const rootCheck = requireRootOrg(auth);
  if (rootCheck) return rootCheck;

  const roleCheck = requireRole(auth.role, 'member');
  if (roleCheck) return roleCheck;

  const { searchParams } = new URL(request.url);
  const linkId = searchParams.get('id');

  if (!linkId) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'id 파라미터가 필요합니다' } },
      { status: 400 },
    );
  }

  const { error } = await auth.supabase
    .from('workflow_catalog_links')
    .delete()
    .eq('id', linkId)
    .eq('organization_id', auth.organizationId);

  if (error) {
    return NextResponse.json(
      { error: { code: 'DELETE_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
