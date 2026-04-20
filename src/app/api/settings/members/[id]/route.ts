/**
 * API Route: Settings / Member (single)
 * PATCH  /api/settings/members/:id → 멤버 수정 (조직 이동 등)
 * DELETE /api/settings/members/:id → 멤버 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRootOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const rootErr = requireRootOrg(auth);
  if (rootErr) return rootErr;

  if (auth.role !== 'admin' && auth.role !== 'manager') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '권한이 없습니다' } },
      { status: 403 },
    );
  }

  const { id } = await params;
  const { organizationId } = auth;
  const serviceClient = createSupabaseServiceClient();
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if ('organization_id' in body) {
    const newOrgId = body.organization_id as string;
    // 루트 조직이거나 루트의 하위 조직인지 검증
    if (newOrgId === organizationId) {
      updates.organization_id = organizationId;
    } else {
      const { data: subOrg } = await serviceClient
        .from('workflow_organizations')
        .select('id')
        .eq('id', newOrgId)
        .eq('parent_id', organizationId)
        .single();
      if (subOrg) {
        updates.organization_id = newOrgId;
      } else {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: '유효하지 않은 조직입니다' } },
          { status: 400 },
        );
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: '변경할 항목이 없습니다' } },
      { status: 400 },
    );
  }

  // 멤버가 루트 조직 계층에 속하는지 확인 후 업데이트
  const { data: children } = await serviceClient
    .from('workflow_organizations')
    .select('id')
    .eq('parent_id', organizationId);
  const orgIds = [organizationId, ...(children ?? []).map((c: { id: string }) => c.id)];

  const { data, error } = await serviceClient
    .from('workflow_users')
    .update(updates)
    .eq('id', id)
    .in('organization_id', orgIds)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
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

  const rootErr = requireRootOrg(auth);
  if (rootErr) return rootErr;

  if (auth.role !== 'admin' && auth.role !== 'manager') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '권한이 없습니다' } },
      { status: 403 },
    );
  }

  const { id } = await params;

  // 자기 자신은 삭제 불가
  if (id === auth.dbUser.id) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: '자기 자신은 삭제할 수 없습니다' } },
      { status: 400 },
    );
  }

  const { organizationId } = auth;
  const serviceClient = createSupabaseServiceClient();

  // 루트 + 하위 조직 범위에서 삭제
  const { data: children } = await serviceClient
    .from('workflow_organizations')
    .select('id')
    .eq('parent_id', organizationId);
  const orgIds = [organizationId, ...(children ?? []).map((c: { id: string }) => c.id)];

  const { error } = await serviceClient
    .from('workflow_users')
    .delete()
    .eq('id', id)
    .in('organization_id', orgIds);

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
