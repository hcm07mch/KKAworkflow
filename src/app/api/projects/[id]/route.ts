/**
 * API Route: Single Project
 * GET   /api/projects/:id  ? ?濡??????議고
 * PATCH /api/projects/:id  ? ?濡?????
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyProjectInOrg } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;

  const orgError = await verifyProjectInOrg(auth, id);
  if (orgError) return orgError;

  const project = await auth.services.projectRepo.findByIdWithRelations(id);

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

  const orgError2 = await verifyProjectInOrg(auth, id);
  if (orgError2) return orgError2;

  const result = await auth.services.projectService.updateProject(
    id,
    body,
    { userId: auth.dbUser.id, userRole: auth.role, organizationId: auth.organizationId },
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // ── 문서 자동 생성은 제거됨 ──
  // 문서는 이제 클라이언트의 handleWorkflowAdd에서 POST /api/documents로 직접 생성.
  // 동일 그룹의 플로우가 여러 개 추가될 수 있으므로, 매 플로우마다 새 문서를 생성한다.

  return NextResponse.json(result.data);
}
