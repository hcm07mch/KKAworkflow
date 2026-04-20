/**
 * API Route: Project Assignees
 * GET    /api/projects/[id]/assignees → 담당자 목록 조회
 * POST   /api/projects/[id]/assignees → 담당자 추가
 * DELETE /api/projects/[id]/assignees → 담당자 제거 (body: { user_id })
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyProjectInOrg } from '@/lib/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;

  const orgError = await verifyProjectInOrg(auth, id);
  if (orgError) return orgError;

  const assignees = await auth.services.assigneeRepo.findByProjectId(id);
  return NextResponse.json(assignees);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id: projectId } = await params;
  const body = await request.json();

  const orgError = await verifyProjectInOrg(auth, projectId);
  if (orgError) return orgError;

  if (!body.user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  const assignee = await auth.services.assigneeRepo.add({
    project_id: projectId,
    user_id: body.user_id,
    role: body.role ?? 'member',
    assigned_by: auth.dbUser.id,
  });

  // 배정된 사용자에게 알림
  const project = await auth.services.projectRepo.findById(projectId);
  if (project) {
    await auth.services.notificationService.notifyUser({
      recipientId: body.user_id,
      projectId,
      type: 'assignee_added',
      title: `${project.title} 프로젝트에 담당자로 배정되었습니다`,
      link: `/projects/${projectId}`,
    });
  }

  return NextResponse.json(assignee, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id: projectId } = await params;
  const body = await request.json();

  const orgError = await verifyProjectInOrg(auth, projectId);
  if (orgError) return orgError;

  if (!body.user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  await auth.services.assigneeRepo.remove(projectId, body.user_id);
  return NextResponse.json({ ok: true });
}
