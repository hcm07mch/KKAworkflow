/**
 * API Route 공용 인증 헬퍼
 *
 * Route Handler에서 인증/사용자 조회 + 서비스 인스턴스 생성을 한번에 처리합니다.
 *
 * 사용법:
 *   const auth = await getAuthContext();
 *   if (!auth.success) return auth.response;
 *   const { user, dbUser, services } = auth;
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/infrastructure/supabase/server';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';
import { createServices } from '@/lib/service-factory';
import type { User } from '@/lib/domain/types';
import type { UserRole } from '@/lib/domain/types';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthContext {
  success: true;
  /** Supabase Auth user (auth.users) */
  authUser: { id: string; email: string };
  /** 앱 DB user (public.users) */
  dbUser: User;
  /** 사용자 역할 */
  role: UserRole;
  /** 루트 조직 ID (데이터 스코핑용) */
  organizationId: string;
  /** 사용자 소속 조직 ID (하위 조직일 수 있음) */
  userOrganizationId: string;
  /** 서비스 인스턴스 모음 */
  services: ReturnType<typeof createServices>;
  /** Raw Supabase client (커스텀 쿼리용) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}

export interface AuthError {
  success: false;
  response: NextResponse;
}

export type AuthResult = AuthContext | AuthError;

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * 인증 컨텍스트 조회
 *
 * 1. Supabase 세션으로 auth user 조회
 * 2. public.users 테이블에서 user 정보 조회
 * 3. 서비스 인스턴스 생성 (organizationId 바인딩)
 */
export async function getAuthContext(): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();

  // 1) Auth user 조회
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser || !authUser.email) {
    return {
      success: false,
      response: NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다' } },
        { status: 401 },
      ),
    };
  }

  // 2) 앱 DB user 정보 조회 (service role로 RLS 우회 - 순환 참조 방지)
  const serviceClient = createSupabaseServiceClient();
  const { data: dbUser, error: userError } = await serviceClient
    .from('workflow_users')
    .select('*')
    .eq('auth_id', authUser.id)
    .eq('is_active', true)
    .single() as { data: User | null; error: unknown };

  if (userError || !dbUser) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: {
            code: 'USER_NOT_FOUND',
            message: '사용자 정보를 찾을 수 없습니다',
          },
        },
        { status: 403 },
      ),
    };
  }

  // 3) 루트 조직 ID 확인 (하위 조직이면 상위로 탐색)
  let rootOrgId = dbUser.organization_id;
  const { data: orgRow } = await serviceClient
    .from('workflow_organizations')
    .select('id, parent_id')
    .eq('id', dbUser.organization_id)
    .single();

  if (orgRow?.parent_id) {
    rootOrgId = orgRow.parent_id;
  }

  // 4) 서비스 인스턴스 생성 (루트 조직 기준)
  const services = createServices(supabase, {
    organizationId: rootOrgId,
  });

  return {
    success: true,
    authUser: { id: authUser.id, email: authUser.email },
    dbUser: dbUser as User,
    role: dbUser.role as UserRole,
    organizationId: rootOrgId,
    userOrganizationId: dbUser.organization_id,
    services,
    supabase,
  };
}

// ============================================================================
// ROLE CHECK HELPERS
// ============================================================================

const ROLE_LEVELS: Record<UserRole, number> = {
  admin: 100,
  manager: 50,
  member: 10,
};

/**
 * 최소 역할 권한 검사
 * 부족하면 403 Response 반환, 충분하면 null.
 */
export function requireRole(
  currentRole: UserRole,
  minimumRole: UserRole,
): NextResponse | null {
  if (ROLE_LEVELS[currentRole] < ROLE_LEVELS[minimumRole]) {
    return NextResponse.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: `이 작업은 ${minimumRole} 이상 권한이 필요합니다`,
        },
      },
      { status: 403 },
    );
  }
  return null;
}
