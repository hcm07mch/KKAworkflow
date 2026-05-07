/**
 * API Route: Landing Inquiry by ID
 * PATCH  /api/landing-inquiries/[id]  → 상태/메모 업데이트 (admin 전용)
 * DELETE /api/landing-inquiries/[id]  → 삭제 (admin 전용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

const ALLOWED_STATUSES = ['new', 'contacted', 'closed', 'spam'] as const;
type InquiryStatus = (typeof ALLOWED_STATUSES)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const roleError = requireRole(auth.role, 'admin');
  if (roleError) return roleError;

  const { id } = await params;
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

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: { code: 'NO_FIELDS', message: '변경할 필드가 없습니다' } },
      { status: 400 },
    );
  }

  const serviceClient = createSupabaseServiceClient();
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

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const roleError = requireRole(auth.role, 'admin');
  if (roleError) return roleError;

  const { id } = await params;

  const serviceClient = createSupabaseServiceClient();
  const { error } = await serviceClient.from('landing_inquiries').delete().eq('id', id);

  if (error) {
    return NextResponse.json(
      { error: { code: 'DELETE_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
