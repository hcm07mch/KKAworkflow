/**
 * API Route: Mark all notifications as read
 * POST /api/notifications/read-all
 */

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function POST() {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  await auth.services.notificationService.markAllAsRead(auth.dbUser.id);
  return NextResponse.json({ ok: true });
}
