/**
 * GET /api/auth/me — 현재 로그인 사용자 정보 반환
 */

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  return NextResponse.json({
    id: auth.dbUser.id,
    role: auth.role,
    name: auth.dbUser.name,
  });
}
