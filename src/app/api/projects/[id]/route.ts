/**
 * API Route: Single Project
 * GET   /api/projects/:id  ? ?濡??????議고
 * PATCH /api/projects/:id  ? ?濡?????
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;
  const project = await auth.services.projectRepo.findById(id);

  if (!project) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '?濡??몃? 李얠 ? ??듬??' } },
      { status: 404 },
    );
  }
  return NextResponse.json(project);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;
  const body = await request.json();

  const result = await auth.services.projectService.updateProject(
    id,
    body,
    { userId: auth.dbUser.id, userRole: auth.role, organizationId: auth.organizationId },
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.data);
}
