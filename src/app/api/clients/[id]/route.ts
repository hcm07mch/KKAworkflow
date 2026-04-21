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

  // organization_id 변경 요청 시: 사용자 허용 조직 범위(본사 계정은 fullAllowedOrgIds) 내에서만 허용
  let organizationIdUpdate: string | undefined;
  if (body.organization_id !== undefined) {
    if (typeof body.organization_id !== 'string' || !auth.fullAllowedOrgIds.includes(body.organization_id)) {
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
    ...(body.business_number !== undefined && { business_number: body.business_number }),
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
  let migratedProjectCount = 0;
  if (organizationIdUpdate !== undefined && body.migrate_projects === true) {
    const { data: migrated, error: projectError } = await serviceClient
      .from('workflow_projects')
      .update({ organization_id: organizationIdUpdate })
      .eq('client_id', id)
      .select('id');

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
    migratedProjectCount = migrated?.length ?? 0;

    // 이관된 프로젝트에 종속된 org-scoped 보조 데이터도 함께 이관
    //  - workflow_activity_logs: 프로젝트 관련 로그는 project_id 로 연결되어 있으며, RLS/스코프 필터용 organization_id 컬럼을 가짐
    //  - workflow_notifications: organization_id 로 스코프되어 있어 이관 후 대상 조직에서 조회 가능해야 함
    // 문서(workflow_project_documents)와 승인(workflow_document_approvals)은 organization_id 컬럼이 없고 project 를 통해 조직 스코프를 따라가므로 별도 업데이트 불필요.
    const migratedProjectIds = (migrated ?? []).map((p: { id: string }) => p.id);
    if (migratedProjectIds.length > 0) {
      // 활동 로그 organization_id 동기화
      await serviceClient
        .from('workflow_activity_logs')
        .update({ organization_id: organizationIdUpdate })
        .in('project_id', migratedProjectIds);

      // 알림 organization_id 동기화
      await serviceClient
        .from('workflow_notifications')
        .update({ organization_id: organizationIdUpdate })
        .in('project_id', migratedProjectIds);
    }
  }

  return NextResponse.json({ ...updated, migrated_project_count: migratedProjectCount });
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
