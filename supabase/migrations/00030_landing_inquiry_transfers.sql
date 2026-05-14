-- ============================================================================
-- 00030: landing_inquiry_transfers (랜딩 문의 조직 이전 기록)
-- ----------------------------------------------------------------------------
-- 목적:
--   - 랜딩 문의(landing_inquiries)가 본사 ↔ 지사 간 이전될 때 이력을 남김
--   - 누가, 언제, 어느 조직 → 어느 조직으로 이전했는지 audit trail 보존
--   - landing_inquiries.organization_id 가 UPDATE 될 때 트리거가 자동 INSERT
-- ============================================================================

-- 1) 테이블
CREATE TABLE IF NOT EXISTS public.landing_inquiry_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id UUID NOT NULL REFERENCES public.landing_inquiries(id) ON DELETE CASCADE,
    from_organization_id UUID REFERENCES public.workflow_organizations(id) ON DELETE SET NULL,
    to_organization_id UUID REFERENCES public.workflow_organizations(id) ON DELETE SET NULL,
    transferred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lit_inquiry_id
    ON public.landing_inquiry_transfers(inquiry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lit_to_org
    ON public.landing_inquiry_transfers(to_organization_id);

-- 2) RLS: 본사 계정만 SELECT (API 라우트가 service-role 로 INSERT 하므로 INSERT 정책은 불필요)
ALTER TABLE public.landing_inquiry_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lit_select_root_org" ON public.landing_inquiry_transfers;
CREATE POLICY "lit_select_root_org"
    ON public.landing_inquiry_transfers
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.workflow_users wu
            JOIN public.workflow_organizations wo ON wo.id = wu.organization_id
            WHERE wu.auth_id = auth.uid()
              AND wo.parent_id IS NULL
        )
    );

-- 3) UPDATE 트리거: organization_id 가 변경되면 자동으로 이전 기록 INSERT
--    (API 라우트에서 이미 명시적으로 INSERT 하더라도, 다른 경로(SQL 직접 수정 등)에서
--     변경되었을 때도 이력이 빠지지 않도록 안전망 역할)
CREATE OR REPLACE FUNCTION public.fn_landing_inquiries_log_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
        -- 같은 트랜잭션에서 API 가 이미 INSERT 했다면 중복 방지 (1초 이내 동일 변경 무시)
        IF NOT EXISTS (
            SELECT 1
            FROM public.landing_inquiry_transfers
            WHERE inquiry_id = NEW.id
              AND from_organization_id IS NOT DISTINCT FROM OLD.organization_id
              AND to_organization_id IS NOT DISTINCT FROM NEW.organization_id
              AND created_at > NOW() - INTERVAL '5 seconds'
        ) THEN
            INSERT INTO public.landing_inquiry_transfers (
                inquiry_id, from_organization_id, to_organization_id, transferred_by, note
            ) VALUES (
                NEW.id, OLD.organization_id, NEW.organization_id, auth.uid(), NULL
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_landing_inquiries_log_transfer ON public.landing_inquiries;
CREATE TRIGGER trg_landing_inquiries_log_transfer
    AFTER UPDATE OF organization_id ON public.landing_inquiries
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_landing_inquiries_log_transfer();

COMMENT ON TABLE public.landing_inquiry_transfers IS '랜딩 문의 조직 이전 이력 (본사 ↔ 지사)';
