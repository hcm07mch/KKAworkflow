/**
 * API Route: Project Status Transition
 * POST /api/projects/:id/transition  ? ?? ???
 *
 * Body: { "status": "quoted" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyProjectInOrg } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;
  const { status, reason } = await request.json();

  const orgError = await verifyProjectInOrg(auth, id);
  if (orgError) return orgError;

  const result = await auth.services.projectService.transitionStatus(
    { project_id: id, to_status: status, reason },
    { userId: auth.dbUser.id, userRole: auth.role, organizationId: auth.organizationId },
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.data);
}
