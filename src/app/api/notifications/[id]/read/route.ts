/**
 * API Route: Mark single notification as read
 * PATCH /api/notifications/[id]/read
 */

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;
  const notification = await auth.services.notificationService.markAsRead(id);
  return NextResponse.json(notification);
}
