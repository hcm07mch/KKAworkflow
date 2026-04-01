/**
 * API Route: Project Documents
 * GET  /api/projects/:id/documents  ? ?濡???臾몄 紐⑸?
 * POST /api/projects/:id/documents  ? 臾몄 ???
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

  const documents = await auth.services.documentRepo.findByProjectId(id);

  return NextResponse.json(documents);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;
  const body = await request.json();

  const result = await auth.services.documentService.createProjectDocument(
    {
      ...body,
      project_id: id,
      organization_id: auth.organizationId,
    },
    { userId: auth.dbUser.id, userRole: auth.role, organizationId: auth.organizationId },
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.data, { status: 201 });
}
