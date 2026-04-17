/**
 * API Route: Settings / Member (single)
 * DELETE /api/settings/members/:id → 멤버 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

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

  const { supabase, organizationId } = auth;

  const { error } = await supabase
    .from('workflow_users')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId);

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
