/**
 * API Route: Client by ID
 * PATCH  /api/clients/[id]  → 고객사 정보 수정
 * DELETE /api/clients/[id]  → 고객사 삭제 (비활성화)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;
  const body = await request.json();

  // 고객사 존재 확인
  const existing = await auth.services.clientRepo.findById(id);
  if (!existing) {
    return NextResponse.json(
      { error: '고객사를 찾을 수 없습니다.' },
      { status: 404 },
    );
  }

  const updated = await auth.services.clientRepo.update(id, {
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
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;

  const existing = await auth.services.clientRepo.findById(id);
  if (!existing) {
    return NextResponse.json(
      { error: '고객사를 찾을 수 없습니다.' },
      { status: 404 },
    );
  }

  // 소프트 삭제: is_active = false
  await auth.services.clientRepo.update(id, { is_active: false });

  return NextResponse.json({ success: true });
}
