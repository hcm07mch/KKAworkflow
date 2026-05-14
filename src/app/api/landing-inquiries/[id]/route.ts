/**
 * API Route: Landing Inquiry by ID
 * PATCH  /api/landing-inquiries/[id]  → 상태/메모/소속 조직 업데이트
 * DELETE /api/landing-inquiries/[id]  → 삭제
 *
 * 접근 제어:
 *   - 본사 계정: 활성 스코프(allowedOrgIds) 안의 문의 조작 가능
 *   - 지사 계정: 본인 조직으로 이관(handover)된 문의의 상태/메모 조작 가능
 *                  (단, 다른 조직으로의 재이관은 허용되지 않음)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

const ALLOWED_STATUSES = ['new', 'contacted', 'closed', 'spam'] as const;
type InquiryStatus = (typeof ALLOWED_STATUSES)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;

  // 대상 문의의 조직이 현재 사용자의 allowedOrgIds 안에 속하는지 검증
  const serviceClient = createSupabaseServiceClient();
  const { data: existing, error: fetchError } = await serviceClient
    .from('landing_inquiries')
    .select('organization_id')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) {
    return NextResponse.json(
      { error: { code: 'QUERY_FAILED', message: fetchError.message } },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '문의를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }
  // 본사 계정은 활성 스코프와 무관하게 본사+모든 지사 문의를 조작할 수 있어야 함
  const accessibleOrgIds = auth.isRootOrg ? auth.fullAllowedOrgIds : auth.allowedOrgIds;
  if (!accessibleOrgIds.includes(existing.organization_id as string)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN_ORG', message: '이 문의에 접근할 권한이 없습니다' } },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));

  const update: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!(ALLOWED_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json(
        { error: { code: 'INVALID_STATUS', message: '허용되지 않는 상태값입니다' } },
        { status: 400 },
      );
    }
    update.status = body.status as InquiryStatus;
    // 처리자는 항상 현재 로그인 사용자(auth.users.id)로 자동 기록 (new 로 되돌릴 때는 초기화)
    // landing_inquiries.handled_by 는 auth.users(id) 외래키이므로 authUser.id 사용
    if (body.status !== 'new') {
      update.handled_by = auth.authUser.id;
      update.handled_at = new Date().toISOString();
    } else {
      update.handled_by = null;
      update.handled_at = null;
    }
  }

  if (body.admin_note !== undefined) {
    update.admin_note = body.admin_note === '' ? null : String(body.admin_note);
  }

  // 기본 정보 필드 (이름/연락처/업종/지역) — 길이 제한 적용
  if (body.name !== undefined) {
    const trimmed = body.name === null ? '' : String(body.name).trim();
    update.name = trimmed === '' ? null : trimmed.slice(0, 100);
  }
  if (body.phone !== undefined) {
    const trimmed = String(body.phone ?? '').trim();
    if (trimmed === '') {
      return NextResponse.json(
        { error: { code: 'PHONE_REQUIRED', message: '연락처는 필수입니다' } },
        { status: 400 },
      );
    }
    update.phone = trimmed.slice(0, 30);
  }
  if (body.industry !== undefined) {
    const trimmed = body.industry === null ? '' : String(body.industry).trim();
    update.industry = trimmed === '' ? null : trimmed.slice(0, 100);
  }
  if (body.region !== undefined) {
    const trimmed = body.region === null ? '' : String(body.region).trim();
    update.region = trimmed === '' ? null : trimmed.slice(0, 100);
  }

  let transferNote: string | null = null;
  if (body.organization_id !== undefined) {
    if (!auth.isRootOrg) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: '조직 이전은 본사 계정만 가능합니다' } },
        { status: 403 },
      );
    }
    const newOrgId = body.organization_id ? String(body.organization_id) : null;
    if (!newOrgId) {
      return NextResponse.json(
        { error: { code: 'ORG_REQUIRED', message: '소속 조직은 필수입니다' } },
        { status: 400 },
      );
    }
    // 본사 계정 본인 조직 또는 하위 지사로만 이동 허용
    if (!auth.fullAllowedOrgIds.includes(newOrgId)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN_ORG', message: '허용되지 않은 조직입니다' } },
        { status: 403 },
      );
    }
    update.organization_id = newOrgId;
    if (body.transfer_note !== undefined && body.transfer_note !== null) {
      const trimmed = String(body.transfer_note).trim();
      transferNote = trimmed === '' ? null : trimmed.slice(0, 500);
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: { code: 'NO_FIELDS', message: '변경할 필드가 없습니다' } },
      { status: 400 },
    );
  }

  const previousOrgId = (existing as { organization_id: string | null }).organization_id ?? null;

  const { data, error } = await serviceClient
    .from('landing_inquiries')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    console.error('[landing-inquiries PATCH] update failed', {
      id,
      update,
      error,
    });
    return NextResponse.json(
      {
        error: {
          code: 'UPDATE_FAILED',
          message: error?.message ?? '수정에 실패했습니다',
          details: error?.details ?? null,
          hint: error?.hint ?? null,
        },
      },
      { status: 500 },
    );
  }

  // 조직이 실제로 변경된 경우 이전 이력 기록
  if (
    update.organization_id !== undefined &&
    previousOrgId !== (update.organization_id as string)
  ) {
    const { error: transferError } = await serviceClient
      .from('landing_inquiry_transfers')
      .insert({
        inquiry_id: id,
        from_organization_id: previousOrgId,
        to_organization_id: update.organization_id as string,
        transferred_by: auth.authUser.id,
        note: transferNote,
      });
    if (transferError) {
      console.error('[landing-inquiries PATCH] transfer log failed', {
        id,
        previousOrgId,
        newOrgId: update.organization_id,
        error: transferError,
      });
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;

  const serviceClient = createSupabaseServiceClient();

  // 대상 문의의 조직이 현재 사용자의 allowedOrgIds 안에 속하는지 검증
  const { data: existing, error: fetchError } = await serviceClient
    .from('landing_inquiries')
    .select('organization_id')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) {
    return NextResponse.json(
      { error: { code: 'QUERY_FAILED', message: fetchError.message } },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '문의를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }
  // 본사 계정은 활성 스코프와 무관하게 본사+모든 지사 문의를 삭제할 수 있어야 함
  const accessibleOrgIds = auth.isRootOrg ? auth.fullAllowedOrgIds : auth.allowedOrgIds;
  if (!accessibleOrgIds.includes(existing.organization_id as string)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN_ORG', message: '이 문의에 접근할 권한이 없습니다' } },
      { status: 403 },
    );
  }

  const { error } = await serviceClient.from('landing_inquiries').delete().eq('id', id);

  if (error) {
    return NextResponse.json(
      { error: { code: 'DELETE_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
