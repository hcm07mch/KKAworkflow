/**
 * API Route: Landing Inquiry Transfers
 * GET /api/landing-inquiries/[id]/transfers → 해당 문의의 조직 이전 이력 (본사 계정만)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  if (!auth.isRootOrg) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '이전 이력은 본사 계정만 조회할 수 있습니다' } },
      { status: 403 },
    );
  }

  const { id } = await params;
  const serviceClient = createSupabaseServiceClient();

  // 대상 문의가 본사 관할(fullAllowedOrgIds) 안에 있는지 확인
  const { data: inquiry, error: inqErr } = await serviceClient
    .from('landing_inquiries')
    .select('organization_id')
    .eq('id', id)
    .maybeSingle();
  if (inqErr) {
    return NextResponse.json(
      { error: { code: 'QUERY_FAILED', message: inqErr.message } },
      { status: 500 },
    );
  }
  if (!inquiry) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '문의를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }
  if (!auth.fullAllowedOrgIds.includes(inquiry.organization_id as string)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN_ORG', message: '이 문의에 접근할 권한이 없습니다' } },
      { status: 403 },
    );
  }

  // 이전 이력 + 조직명 + 작업자 이름 조인
  const { data: rows, error } = await serviceClient
    .from('landing_inquiry_transfers')
    .select(
      `
        id,
        inquiry_id,
        from_organization_id,
        to_organization_id,
        transferred_by,
        note,
        created_at,
        from_org:workflow_organizations!landing_inquiry_transfers_from_organization_id_fkey ( id, name ),
        to_org:workflow_organizations!landing_inquiry_transfers_to_organization_id_fkey ( id, name )
      `,
    )
    .eq('inquiry_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: { code: 'QUERY_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  // 작업자 이름 매핑 (workflow_users.auth_id 기준)
  const authIds = Array.from(
    new Set((rows ?? []).map((r) => r.transferred_by).filter(Boolean) as string[]),
  );
  const userMap = new Map<string, string>();
  if (authIds.length > 0) {
    const { data: users } = await serviceClient
      .from('workflow_users')
      .select('auth_id, name')
      .in('auth_id', authIds);
    for (const u of (users ?? []) as Array<{ auth_id: string; name: string | null }>) {
      if (u.auth_id) userMap.set(u.auth_id, u.name ?? '');
    }
  }

  const result = (rows ?? []).map((r: any) => ({
    id: r.id,
    inquiry_id: r.inquiry_id,
    from_organization_id: r.from_organization_id,
    from_organization_name: r.from_org?.name ?? null,
    to_organization_id: r.to_organization_id,
    to_organization_name: r.to_org?.name ?? null,
    transferred_by: r.transferred_by,
    transferred_by_name: r.transferred_by ? userMap.get(r.transferred_by) ?? null : null,
    note: r.note,
    created_at: r.created_at,
  }));

  return NextResponse.json(result);
}
