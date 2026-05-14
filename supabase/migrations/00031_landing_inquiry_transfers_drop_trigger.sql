-- ============================================================================
-- 00031: landing_inquiry_transfers 트리거 제거 + 중복 행 정리
-- ----------------------------------------------------------------------------
-- 00030 에서 추가한 AFTER UPDATE 트리거가 API 라우트의 명시적 INSERT 와 함께
-- 동작하여 한 번의 이전 작업마다 2건의 이력이 남는 문제 해결.
-- 트리거는 5초 dedupe 체크를 했지만, API 가 UPDATE 후에 INSERT 하므로 트리거
-- 실행 시점에는 dedupe 대상이 존재하지 않아 항상 중복 INSERT 가 발생했다.
--
-- 이후 이력 기록은 API 라우트(PATCH /api/landing-inquiries/[id])에서만 책임진다.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_landing_inquiries_log_transfer ON public.landing_inquiries;
DROP FUNCTION IF EXISTS public.fn_landing_inquiries_log_transfer();

-- 트리거가 만들었던 중복 행(transferred_by IS NULL) 정리:
-- 동일 inquiry_id + from/to + 5초 이내에 사용자 기록이 있는 NULL 행만 제거
DELETE FROM public.landing_inquiry_transfers t
WHERE t.transferred_by IS NULL
  AND EXISTS (
      SELECT 1
      FROM public.landing_inquiry_transfers other
      WHERE other.id <> t.id
        AND other.inquiry_id = t.inquiry_id
        AND other.from_organization_id IS NOT DISTINCT FROM t.from_organization_id
        AND other.to_organization_id IS NOT DISTINCT FROM t.to_organization_id
        AND other.transferred_by IS NOT NULL
        AND ABS(EXTRACT(EPOCH FROM (other.created_at - t.created_at))) < 5
  );
