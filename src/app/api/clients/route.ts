/**
 * API Route: Clients
 * GET  /api/clients  → 고객사 목록 조회
 * POST /api/clients  → 고객사 등록 (+ 영업 상태 프로젝트 자동 생성)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  // 루트 조직 + 하위 조직 전체 고객사 조회
  const serviceClient = createSupabaseServiceClient();

  const { data: clients, error } = await serviceClient
    .from('workflow_clients')
    .select('*, organization:workflow_organizations(id, name)')
    .in('organization_id', auth.allowedOrgIds)
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(clients ?? []);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const body = await request.json();

  // 프로젝트 관련 필드를 분리
  const {
    project_title, project_description, project_owner_id,
    service_type, payment_type,
    ...clientData
  } = body;

  // 1. 고객사 생성
  const client = await auth.services.clientRepo.create({
    ...clientData,
    organization_id: auth.userOrganizationId,
  });

  // 2. '영업(A_sales)' 상태의 프로젝트 자동 생성
  const projectResult = await auth.services.projectService.createProject(
    {
      client_id: client.id,
      title: project_title || `${client.name} 프로젝트`,
      description: project_description || '고객사 등록 시 자동 생성된 프로젝트',
      service_type: service_type ?? 'viral',
      payment_type: payment_type ?? 'deposit',
      ...(project_owner_id ? { owner_id: project_owner_id } : {}),
    },
    {
      userId: auth.dbUser.id,
      userRole: auth.role,
      organizationId: auth.organizationId,
    },
  );

  return NextResponse.json(
    { ...client, project: projectResult.success ? projectResult.data : null },
    { status: 201 },
  );
}
