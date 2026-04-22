/**
 * API Route: Sync catalog from HQ (headquarters) to current branch scope
 * POST /api/settings/catalogs/sync-from-hq
 *   body: { catalog_type: 'estimate' | 'execution' }
 *
 * 지사(하위 조직) 스코프에서 호출하면 본사(부모 조직)의 카탈로그/카테고리를
 * 현재 지사로 복사(업서트)합니다.
 * - 카테고리: name 기준 업서트 (누락된 것만 추가)
 * - 카탈로그 항목: name 기준 업서트 (없으면 추가, 있으면 content/price/카테고리/정렬 갱신)
 * - 지사에만 있고 본사에 없는 항목은 건드리지 않습니다 (비파괴).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

type CatalogType = 'estimate' | 'execution';

interface CategoryRow {
  id: string;
  organization_id: string;
  catalog_type: CatalogType;
  name: string;
  sort_order: number;
}

interface CatalogItemRow {
  id: string;
  organization_id: string;
  catalog_type: CatalogType;
  group_name: string | null;
  category_id: string | null;
  name: string;
  sort_order: number;
  base_price: number | null;
  content: unknown;
  is_active: boolean;
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const body = await request.json().catch(() => ({} as { catalog_type?: string }));
  const catalogType = body.catalog_type as CatalogType | undefined;
  if (catalogType !== 'estimate' && catalogType !== 'execution') {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'catalog_type(estimate|execution)이 필요합니다' } },
      { status: 400 },
    );
  }

  const service = createSupabaseServiceClient();

  // 현재 활성 스코프(지사) 확인
  const { data: ownOrg, error: ownOrgErr } = await service
    .from('workflow_organizations')
    .select('id, parent_id')
    .eq('id', auth.organizationId)
    .single();

  if (ownOrgErr || !ownOrg) {
    return NextResponse.json(
      { error: { code: 'ORG_NOT_FOUND', message: '조직 정보를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }

  if (!ownOrg.parent_id) {
    return NextResponse.json(
      { error: { code: 'NOT_BRANCH', message: '지사 스코프에서만 본사 카탈로그를 동기화할 수 있습니다' } },
      { status: 403 },
    );
  }

  const hqOrgId = ownOrg.parent_id as string;
  const branchOrgId = ownOrg.id as string;

  // 1) 본사 카테고리/카탈로그 항목 조회 (service role: RLS 우회)
  const [hqCategoriesRes, hqItemsRes] = await Promise.all([
    service
      .from('workflow_catalog_categories')
      .select('*')
      .eq('organization_id', hqOrgId)
      .eq('catalog_type', catalogType)
      .order('sort_order', { ascending: true }),
    service
      .from('workflow_service_catalog')
      .select('*')
      .eq('organization_id', hqOrgId)
      .eq('catalog_type', catalogType)
      .order('sort_order', { ascending: true }),
  ]);

  if (hqCategoriesRes.error) {
    return NextResponse.json(
      { error: { code: 'HQ_FETCH_FAILED', message: hqCategoriesRes.error.message } },
      { status: 500 },
    );
  }
  if (hqItemsRes.error) {
    return NextResponse.json(
      { error: { code: 'HQ_FETCH_FAILED', message: hqItemsRes.error.message } },
      { status: 500 },
    );
  }

  const hqCategories = (hqCategoriesRes.data ?? []) as CategoryRow[];
  const hqItems = (hqItemsRes.data ?? []) as CatalogItemRow[];

  if (hqCategories.length === 0 && hqItems.length === 0) {
    return NextResponse.json({
      success: true,
      categoriesAdded: 0,
      itemsAdded: 0,
      itemsUpdated: 0,
      message: '본사에 동기화할 항목이 없습니다',
    });
  }

  // 2) 지사 기존 데이터 조회
  const [branchCatsRes, branchItemsRes] = await Promise.all([
    service
      .from('workflow_catalog_categories')
      .select('id, name, sort_order')
      .eq('organization_id', branchOrgId)
      .eq('catalog_type', catalogType),
    service
      .from('workflow_service_catalog')
      .select('id, name')
      .eq('organization_id', branchOrgId)
      .eq('catalog_type', catalogType),
  ]);

  if (branchCatsRes.error) {
    return NextResponse.json(
      { error: { code: 'BRANCH_FETCH_FAILED', message: branchCatsRes.error.message } },
      { status: 500 },
    );
  }
  if (branchItemsRes.error) {
    return NextResponse.json(
      { error: { code: 'BRANCH_FETCH_FAILED', message: branchItemsRes.error.message } },
      { status: 500 },
    );
  }

  const branchCats = (branchCatsRes.data ?? []) as Array<{ id: string; name: string; sort_order: number }>;
  const branchItems = (branchItemsRes.data ?? []) as Array<{ id: string; name: string }>;

  // 3) 카테고리 업서트 (name 기준)
  const branchCatByName = new Map<string, { id: string; name: string; sort_order: number }>();
  for (const c of branchCats) branchCatByName.set(c.name, c);

  const hqCatIdToBranchCatId = new Map<string, string>();
  let categoriesAdded = 0;

  for (const hc of hqCategories) {
    const existing = branchCatByName.get(hc.name);
    if (existing) {
      hqCatIdToBranchCatId.set(hc.id, existing.id);
      continue;
    }
    const { data: inserted, error } = await service
      .from('workflow_catalog_categories')
      .insert({
        organization_id: branchOrgId,
        catalog_type: catalogType,
        name: hc.name,
        sort_order: hc.sort_order ?? 0,
      })
      .select('id, name, sort_order')
      .single();
    if (error || !inserted) continue;
    hqCatIdToBranchCatId.set(hc.id, inserted.id as string);
    branchCatByName.set(inserted.name as string, inserted as { id: string; name: string; sort_order: number });
    categoriesAdded += 1;
  }

  // 4) 카탈로그 항목 업서트 (name 기준)
  const branchItemByName = new Map<string, { id: string; name: string }>();
  for (const i of branchItems) branchItemByName.set(i.name, i);

  let itemsAdded = 0;
  let itemsUpdated = 0;
  const failures: string[] = [];

  for (const hi of hqItems) {
    const mappedCategoryId = hi.category_id
      ? hqCatIdToBranchCatId.get(hi.category_id) ?? null
      : null;
    const existing = branchItemByName.get(hi.name);

    if (existing) {
      const { error } = await service
        .from('workflow_service_catalog')
        .update({
          group_name: hi.group_name,
          category_id: mappedCategoryId,
          base_price: hi.base_price ?? 0,
          content: hi.content ?? {},
          is_active: hi.is_active ?? true,
          sort_order: hi.sort_order ?? 0,
        })
        .eq('id', existing.id)
        .eq('organization_id', branchOrgId);
      if (error) {
        failures.push(`${hi.name}: ${error.message}`);
      } else {
        itemsUpdated += 1;
      }
    } else {
      const { error } = await service
        .from('workflow_service_catalog')
        .insert({
          organization_id: branchOrgId,
          catalog_type: catalogType,
          group_name: hi.group_name,
          category_id: mappedCategoryId,
          name: hi.name,
          sort_order: hi.sort_order ?? 0,
          base_price: hi.base_price ?? 0,
          content: hi.content ?? {},
          is_active: hi.is_active ?? true,
        });
      if (error) {
        failures.push(`${hi.name}: ${error.message}`);
      } else {
        itemsAdded += 1;
      }
    }
  }

  return NextResponse.json({
    success: true,
    categoriesAdded,
    itemsAdded,
    itemsUpdated,
    failures,
  });
}
