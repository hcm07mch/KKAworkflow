-- ============================================================================
-- 00029: landing_inquiries 에 organization_id 추가
-- ----------------------------------------------------------------------------
-- 목적:
--   - 랜딩 문의를 본사/지사 등 조직 단위로 귀속시킬 수 있도록 컬럼 추가
--   - 기존 레코드는 본사(루트 조직: parent_id IS NULL) id 로 백필
--   - 신규 레코드 INSERT 시 organization_id 가 비어 있으면
--     자동으로 본사 id 가 채워지도록 트리거 + 기본 정책 적용
-- ============================================================================

-- 1) 컬럼 추가 (nullable 로 먼저 추가 → 백필 → NOT NULL 전환)
ALTER TABLE public.landing_inquiries
    ADD COLUMN IF NOT EXISTS organization_id UUID
        REFERENCES public.workflow_organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_landing_inquiries_organization_id
    ON public.landing_inquiries(organization_id);

-- 2) 본사(루트 조직) 식별용 헬퍼: parent_id IS NULL 중 가장 먼저 생성된 조직을 본사로 간주
CREATE OR REPLACE FUNCTION public.fn_root_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT id
    FROM public.workflow_organizations
    WHERE parent_id IS NULL
    ORDER BY created_at ASC
    LIMIT 1;
$$;

-- 3) 기존 NULL 레코드를 본사 id 로 백필
UPDATE public.landing_inquiries
SET organization_id = public.fn_root_organization_id()
WHERE organization_id IS NULL;

-- 4) INSERT 시 organization_id 미지정이면 본사 id 로 자동 설정
CREATE OR REPLACE FUNCTION public.fn_landing_inquiries_set_default_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.organization_id IS NULL THEN
        NEW.organization_id := public.fn_root_organization_id();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_landing_inquiries_default_org ON public.landing_inquiries;
CREATE TRIGGER trg_landing_inquiries_default_org
    BEFORE INSERT ON public.landing_inquiries
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_landing_inquiries_set_default_org();

-- 5) 컬럼 기본값(DEFAULT)도 함수로 지정 (트리거 보완용)
ALTER TABLE public.landing_inquiries
    ALTER COLUMN organization_id SET DEFAULT public.fn_root_organization_id();

-- 6) 백필 후 NOT NULL 강제
ALTER TABLE public.landing_inquiries
    ALTER COLUMN organization_id SET NOT NULL;
