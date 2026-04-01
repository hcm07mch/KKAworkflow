/**
 * API Route: Clients
 * GET  /api/clients  ? 怨媛??紐⑸? 議고
 * POST /api/clients  ? 怨媛?????
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { searchParams } = request.nextUrl;
  const clients = await auth.services.clientRepo.findByOrganizationId(
    auth.organizationId,
  );

  return NextResponse.json(clients);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const body = await request.json();

  const client = await auth.services.clientRepo.create({
    ...body,
    organization_id: auth.organizationId,
  });

  return NextResponse.json(client, { status: 201 });
}
