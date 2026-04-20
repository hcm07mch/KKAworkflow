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
import { cookies } from 'next/headers';
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
  /**
   * 조회/쓰기 허용 조직 ID 목록 (활성 스코프 기준).
   * 본사 계정이 지사 업무로 전환하면 이 배열은 해당 지사 1개로 좁혀진다.
   * 고객/프로젝트/문서의 organization_id가 반드시 이 범위 안에 속해야 한다.
   */
  allowedOrgIds: string[];
  /**
   * 활성 스코프와 무관하게 사용자가 원래 볼 수 있는 전체 조직 ID 목록
   * (본사 계정이면 본사 + 모든 지사). 스코프 스위처 UI에서 사용.
   */
  fullAllowedOrgIds: string[];
  /** 사용자가 루트 조직(본사) 소속인지 여부 (parent_id가 없으면 true) */
  isRootOrg: boolean;
  /** 현재 활성 스코프로 선택된 조직 ID (쿠키). 미설정이면 null. */
  activeScope: string | null;
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

  // 3) 허용 조직 ID 집합 계산
  //  - 사용자 본인 조직 + 그 조직의 하위 조직만 노출
  //  - 따라서 하위 조직(예: 지사) 계정은 상위(본사) 데이터를 볼 수 없음
  //  - 상위(본사) 계정은 본인 + 모든 하위 지사 데이터를 볼 수 있음
  const userOrgId = dbUser.organization_id;
  const { data: ownOrg } = await serviceClient
    .from('workflow_organizations')
    .select('parent_id')
    .eq('id', userOrgId)
    .single();
  const isRootOrg = !ownOrg?.parent_id;

  const { data: childOrgs } = await serviceClient
    .from('workflow_organizations')
    .select('id')
    .eq('parent_id', userOrgId);
  const fullAllowedOrgIds = [userOrgId, ...((childOrgs ?? []) as { id: string }[]).map((o) => o.id)];

  // 3-1) 스코프 전환 (본사 계정 전용)
  //  - 본사 계정은 기본적으로 "본사 업무" 스코프 (자기 조직만) 로 시작한다.
  //  - 쿠키 active-scope=<orgId>가 설정되어 있고 그 orgId가 허용 범위 안에 속하면 해당 조직으로 스코프 변경.
  //  - 하위 조직(지사) 계정은 쿠키와 무관하게 항상 자기 조직 범위.
  let effectiveOrgId = userOrgId;
  let allowedOrgIds = fullAllowedOrgIds;
  let activeScope: string | null = null;
  if (isRootOrg) {
    let targetScope: string = userOrgId; // 기본값: 본사 업무 (자기 조직만)
    try {
      const cookieStore = await cookies();
      const scope = cookieStore.get('active-scope')?.value;
      if (scope && fullAllowedOrgIds.includes(scope)) {
        targetScope = scope;
      }
    } catch {
      // cookies() 호출 실패 시 기본값 유지
    }
    effectiveOrgId = targetScope;
    allowedOrgIds = [targetScope];
    activeScope = targetScope;
  }

  // 4) 서비스 인스턴스 생성 (활성 스코프 기준 - 새로 생성되는 데이터는 선택된 조직 소속)
  const services = createServices(supabase, {
    organizationId: effectiveOrgId,
  });

  return {
    success: true,
    authUser: { id: authUser.id, email: authUser.email },
    dbUser: dbUser as User,
    role: dbUser.role as UserRole,
    organizationId: effectiveOrgId,
    userOrganizationId: dbUser.organization_id,
    allowedOrgIds,
    fullAllowedOrgIds,
    isRootOrg,
    activeScope,
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

/**
 * 루트 조직(본사) 소속만 접근 허용.
 * 하위 조직(지사) 계정이면 403 반환.
 */
export function requireRootOrg(auth: AuthContext): NextResponse | null {
  if (!auth.isRootOrg) {
    return NextResponse.json(
      {
        error: {
          code: 'ROOT_ORG_ONLY',
          message: '본사 계정만 접근 가능합니다',
        },
      },
      { status: 403 },
    );
  }
  return null;
}

// ============================================================================
// ORGANIZATION SCOPE HELPERS
// ============================================================================

/**
 * 403 조직 불일치 응답
 */
function forbidOrgMismatch(resource: string): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: 'ORGANIZATION_MISMATCH',
        message: `${resource}에 대한 접근 권한이 없습니다`,
      },
    },
    { status: 403 },
  );
}

/**
 * 404 리소스 없음 응답
 */
function notFound(resource: string): NextResponse {
  return NextResponse.json(
    { error: { code: 'NOT_FOUND', message: `${resource}을(를) 찾을 수 없습니다` } },
    { status: 404 },
  );
}

/**
 * 고객사가 사용자의 허용 조직 범위에 속하는지 검증.
 * - 없으면 404
 * - 다른 조직 소속이면 403
 * - 일치하면 null
 */
export async function verifyClientInOrg(
  auth: AuthContext,
  clientId: string,
): Promise<NextResponse | null> {
  const serviceClient = createSupabaseServiceClient();
  const { data } = await serviceClient
    .from('workflow_clients')
    .select('organization_id')
    .eq('id', clientId)
    .maybeSingle();

  if (!data) return notFound('고객사');
  if (!auth.allowedOrgIds.includes((data as { organization_id: string }).organization_id)) {
    return forbidOrgMismatch('고객사');
  }
  return null;
}

/**
 * 프로젝트가 사용자의 허용 조직 범위에 속하는지 검증.
 */
export async function verifyProjectInOrg(
  auth: AuthContext,
  projectId: string,
): Promise<NextResponse | null> {
  const serviceClient = createSupabaseServiceClient();
  const { data } = await serviceClient
    .from('workflow_projects')
    .select('organization_id')
    .eq('id', projectId)
    .maybeSingle();

  if (!data) return notFound('프로젝트');
  if (!auth.allowedOrgIds.includes((data as { organization_id: string }).organization_id)) {
    return forbidOrgMismatch('프로젝트');
  }
  return null;
}

/**
 * 문서가 사용자의 허용 조직 범위에 속하는지 검증 (project.organization_id 기준).
 */
export async function verifyDocumentInOrg(
  auth: AuthContext,
  documentId: string,
): Promise<NextResponse | null> {
  const serviceClient = createSupabaseServiceClient();
  const { data } = await serviceClient
    .from('workflow_project_documents')
    .select('project:workflow_projects!inner(organization_id)')
    .eq('id', documentId)
    .maybeSingle();

  if (!data) return notFound('문서');
  const projectField = (data as { project: { organization_id: string } | { organization_id: string }[] | null }).project;
  const orgId = Array.isArray(projectField) ? projectField[0]?.organization_id : projectField?.organization_id;
  if (!orgId || !auth.allowedOrgIds.includes(orgId)) {
    return forbidOrgMismatch('문서');
  }
  return null;
}
