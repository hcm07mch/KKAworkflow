/**
 * API Route: Notifications
 * GET  /api/notifications         ? ???由?紐⑸? 議고
 * POST /api/notifications/read-all ? ?泥??쎌 泥由?
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { searchParams } = request.nextUrl;
  const page = Number(searchParams.get('page') ?? 1);
  const limit = Number(searchParams.get('limit') ?? 30);

  const [notifications, unreadCount] = await Promise.all([
    auth.services.notificationService.getMyNotifications(auth.dbUser.id, { page, limit }),
    auth.services.notificationService.getUnreadCount(auth.dbUser.id),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
