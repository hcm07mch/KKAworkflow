/**
 * API Route: Client by ID
 * PATCH  /api/clients/[id]  → 고객사 정보 수정
 * DELETE /api/clients/[id]  → 고객사 삭제 (비활성화)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyClientInOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;
  const body = await request.json();

  // 조직 스코프 검증
  const orgError = await verifyClientInOrg(auth, id);
  if (orgError) return orgError;

  // organization_id 변경 요청 시: 사용자 허용 조직 범위 내에서만 허용
  let organizationIdUpdate: string | undefined;
  if (body.organization_id !== undefined) {
    if (typeof body.organization_id !== 'string' || !auth.allowedOrgIds.includes(body.organization_id)) {
      return NextResponse.json(
        { error: { code: 'ORGANIZATION_NOT_ALLOWED', message: '허용되지 않는 조직입니다' } },
        { status: 403 },
      );
    }
    organizationIdUpdate = body.organization_id;
  }

  // RLS를 우회하여 조직 간 이동을 허용 (앱 계층에서 이미 allowedOrgIds 검증 완료)
  const serviceClient = createSupabaseServiceClient();
  const updatePayload: Record<string, unknown> = {
    ...(body.name !== undefined && { name: body.name }),
    ...(body.contact_name !== undefined && { contact_name: body.contact_name }),
    ...(body.contact_email !== undefined && { contact_email: body.contact_email }),
    ...(body.contact_phone !== undefined && { contact_phone: body.contact_phone }),
    ...(body.address !== undefined && { address: body.address }),
    ...(body.notes !== undefined && { notes: body.notes }),
    ...(body.service_type !== undefined && { service_type: body.service_type }),
    ...(body.payment_type !== undefined && { payment_type: body.payment_type }),
    ...(body.tier !== undefined && { tier: body.tier }),
    ...(body.is_active !== undefined && { is_active: body.is_active }),
    ...(organizationIdUpdate !== undefined && { organization_id: organizationIdUpdate }),
  };

  const { data: updated, error } = await serviceClient
    .from('workflow_clients')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: { code: 'UPDATE_FAILED', message: error?.message ?? '수정에 실패했습니다' } },
      { status: 500 },
    );
  }

  // 조직 이관 시 옵션에 따라 해당 고객의 프로젝트도 함께 이관
  if (organizationIdUpdate !== undefined && body.migrate_projects === true) {
    const { error: projectError } = await serviceClient
      .from('workflow_projects')
      .update({ organization_id: organizationIdUpdate })
      .eq('client_id', id);

    if (projectError) {
      return NextResponse.json(
        {
          error: {
            code: 'PROJECTS_MIGRATION_FAILED',
            message: `고객은 이관되었으나 프로젝트 이관에 실패했습니다: ${projectError.message}`,
          },
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;

  const orgError = await verifyClientInOrg(auth, id);
  if (orgError) return orgError;

  // 소프트 삭제: is_active = false
  await auth.services.clientRepo.update(id, { is_active: false });

  return NextResponse.json({ success: true });
}
