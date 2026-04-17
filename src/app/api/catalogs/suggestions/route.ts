/**
 * API Route: Catalog Suggestions
 * GET /api/catalogs/suggestions?estimate_ids=id1,id2,...
 *
 * 견적서에 선택된 서비스 항목 ID를 기반으로 연결된 집행 카탈로그 항목을 제안합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);
  const estimateIds = searchParams.get('estimate_ids')?.split(',').filter(Boolean) ?? [];

  if (estimateIds.length === 0) {
    return NextResponse.json([]);
  }

  // Find all linked execution catalog items for the given estimate catalog IDs
  const { data: links, error } = await auth.supabase
    .from('workflow_catalog_links')
    .select(`
      execution_catalog_id,
      execution_catalog:workflow_service_catalog!execution_catalog_id(*)
    `)
    .eq('organization_id', auth.organizationId)
    .in('estimate_catalog_id', estimateIds);

  if (error) {
    return NextResponse.json(
      { error: { code: 'FETCH_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  // Deduplicate by execution_catalog_id
  const seen = new Set<string>();
  const suggestions = (links ?? [])
    .filter((link: any) => {
      if (seen.has(link.execution_catalog_id)) return false;
      seen.add(link.execution_catalog_id);
      return true;
    })
    .map((link: any) => link.execution_catalog)
    .filter(Boolean);

  return NextResponse.json(suggestions);
}
