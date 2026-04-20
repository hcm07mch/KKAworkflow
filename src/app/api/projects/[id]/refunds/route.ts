/**
 * API Route: Project Refunds
 * GET  /api/projects/:id/refunds  → 프로젝트 환불 내역 조회
 * POST /api/projects/:id/refunds  → 환불 내역 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyProjectInOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;

  const orgError = await verifyProjectInOrg(auth, id);
  if (orgError) return orgError;

  // 프로젝트 존재 + 권한 확인
  const project = await auth.services.projectRepo.findById(id);
  if (!project) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }

  const serviceClient = createSupabaseServiceClient();
  const { data, error } = await serviceClient
    .from('workflow_project_refunds')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: '환불 내역 조회에 실패했습니다' } },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;
  const body = await request.json();

  const orgError = await verifyProjectInOrg(auth, id);
  if (orgError) return orgError;

  // 입력 검증
  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    return NextResponse.json(
      { error: { code: 'INVALID_AMOUNT', message: '유효한 환불 금액을 입력해 주세요' } },
      { status: 400 },
    );
  }

  // 프로젝트 존재 확인
  const project = await auth.services.projectRepo.findById(id);
  if (!project) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }

  const serviceClient = createSupabaseServiceClient();
  const { data, error } = await serviceClient
    .from('workflow_project_refunds')
    .insert({
      project_id: id,
      amount,
      reason: typeof body.reason === 'string' ? body.reason.trim() || null : null,
      created_by: auth.dbUser.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: '환불 내역 저장에 실패했습니다' } },
      { status: 500 },
    );
  }

  // 활동 로그 기록
  await auth.services.activityLog.log({
    entity_type: 'project',
    entity_id: id,
    project_id: id,
    action: 'refund_created',
    actor_id: auth.dbUser.id,
    description: `환불 처리: ${new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount)}`,
    new_data: { amount, reason: body.reason || null },
  });

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;

  const project = await auth.services.projectRepo.findById(id);
  if (!project) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }

  const serviceClient = createSupabaseServiceClient();
  const { error } = await serviceClient
    .from('workflow_project_refunds')
    .delete()
    .eq('project_id', id);

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: '환불 내역 삭제에 실패했습니다' } },
      { status: 500 },
    );
  }

  await auth.services.activityLog.log({
    entity_type: 'project',
    entity_id: id,
    project_id: id,
    action: 'refund_deleted',
    actor_id: auth.dbUser.id,
    description: '종료 단계 삭제로 환불 내역 제거',
  });

  return NextResponse.json({ success: true });
}
