/**
 * API Route: Projects
 * GET  /api/projects   ? ?濡???紐⑸? 議고
 * POST /api/projects   ? ?濡??????
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { services, organizationId } = auth;
  const { searchParams } = request.nextUrl;

  const result = await services.projectRepo.findByOrganizationId(
    organizationId,
    {},
    {
      page: Number(searchParams.get('page') ?? 1),
      limit: Number(searchParams.get('limit') ?? 20),
    },
  );

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const body = await request.json();
  const result = await auth.services.projectService.createProject(
    {
      ...body,
      organization_id: auth.organizationId,
    },
    { userId: auth.dbUser.id, userRole: auth.role, organizationId: auth.organizationId },
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.data, { status: 201 });
}
