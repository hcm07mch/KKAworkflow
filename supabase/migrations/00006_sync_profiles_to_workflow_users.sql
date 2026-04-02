-- ============================================================================
-- 00006: Sync profiles → workflow_users
--
-- 기존 profiles 테이블에서 tier_code가 admin, manager, branch인 유저를
-- workflow_users 테이블로 동기화합니다.
--
-- tier_code 매핑:
--   admin   → admin
--   manager → manager
--   branch  → member
-- ============================================================================

-- 1. 기본 조직이 없으면 생성
INSERT INTO workflow_organizations (id, name, slug)
SELECT
  uuid_generate_v4(),
  'KKA',
  'kka'
WHERE NOT EXISTS (
  SELECT 1 FROM workflow_organizations LIMIT 1
);

-- 2. profiles → workflow_users 동기화
-- 이미 auth_id가 등록된 유저는 건너뜀 (ON CONFLICT)
INSERT INTO workflow_users (auth_id, organization_id, email, name, role, is_active)
SELECT
  p.user_id,
  (SELECT id FROM workflow_organizations ORDER BY created_at LIMIT 1),
  COALESCE(p.email, ''),
  COALESCE(p.display_name, p.business_owner_name, p.company_name, split_part(COALESCE(p.email, ''), '@', 1)),
  CASE p.tier_code
    WHEN 'admin'   THEN 'admin'
    WHEN 'manager' THEN 'manager'
    WHEN 'branch'  THEN 'member'
  END,
  NOT p.is_kicked
FROM public.profiles p
WHERE p.tier_code IN ('admin', 'manager', 'branch')
ON CONFLICT (auth_id) DO UPDATE SET
  email     = EXCLUDED.email,
  name      = EXCLUDED.name,
  role      = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
