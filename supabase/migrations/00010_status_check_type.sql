-- ============================================================================
-- 00010: 세부 상태 체크 유형 분류 (manual / system)
--
-- 각 프로젝트 세부 상태를 두 가지로 분류:
--   manual  = 실무자가 직접 체크해야 하는 상태
--   system  = 전산 내부 프로세스를 통해 자동으로 체크되는 상태
--
-- manual: A_sales, B3_estimate_sent, B4_estimate_response,
--         C3_contract_sent, C4_contract_signed,
--         D1_payment_pending, E3_prereport_sent, E4_execution,
--         F1_refund, F2_closed
-- system: B1_estimate_draft, B2_estimate_review,
--         C1_contract_draft, C2_contract_review,
--         D2_payment_confirmed,
--         E1_prereport_draft, E2_prereport_review
-- ============================================================================

-- 1. 상태 체크 유형 참조 테이블
CREATE TABLE IF NOT EXISTS workflow_status_check_types (
  status      TEXT PRIMARY KEY,
  check_type  TEXT NOT NULL DEFAULT 'manual'
    CHECK (check_type IN ('manual', 'system')),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 데이터 삽입
INSERT INTO workflow_status_check_types (status, check_type, description) VALUES
  -- A 그룹
  ('A_sales',              'manual', '고객 미팅 및 요구사항 파악'),
  -- B 그룹
  ('B1_estimate_draft',    'system', '견적서 초안 자동 생성'),
  ('B2_estimate_review',   'system', '견적서 내부 승인 프로세스'),
  ('B3_estimate_sent',     'manual', '고객에게 견적서 전달'),
  ('B4_estimate_response', 'manual', '고객 견적 응답 확인'),
  -- C 그룹
  ('C1_contract_draft',    'system', '계약서 초안 자동 생성'),
  ('C2_contract_review',   'system', '계약서 내부 승인 프로세스'),
  ('C3_contract_sent',     'manual', '고객에게 계약서 전달'),
  ('C4_contract_signed',   'manual', '양측 서명 확인'),
  -- D 그룹
  ('D1_payment_pending',   'manual', '고객 입금 요청/대기'),
  ('D2_payment_confirmed', 'system', '입금 확인 자동 처리'),
  -- E 그룹
  ('E1_prereport_draft',   'system', '사전 보고서 자동 생성'),
  ('E2_prereport_review',  'system', '사전 보고서 내부 승인 프로세스'),
  ('E3_prereport_sent',    'manual', '고객에게 보고서 전달'),
  ('E4_execution',         'manual', '바이럴 및 광고 집행'),
  -- F 그룹
  ('F1_refund',            'manual', '환불 처리'),
  ('F2_closed',            'manual', '프로젝트 종료')
ON CONFLICT (status) DO UPDATE SET
  check_type  = EXCLUDED.check_type,
  description = EXCLUDED.description,
  updated_at  = NOW();

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_status_check_type ON workflow_status_check_types(check_type);

-- 4. RLS
ALTER TABLE workflow_status_check_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "status_check_types_select_all" ON workflow_status_check_types;
CREATE POLICY "status_check_types_select_all" ON workflow_status_check_types
  FOR SELECT USING (true);
