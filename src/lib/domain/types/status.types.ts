/**
 * 상태(Status) 관련 상수 및 유틸리티
 *
 * 프로젝트, 문서, 서비스 타입, 결제 방식, 고객 등급, 승인 액션, 사용자 역할 등
 * 모든 상태 관련 상수와 헬퍼 함수를 정의합니다.
 */

// ============================================================================
// PROJECT STATUS
// ============================================================================

export const PROJECT_STATUSES = [
  'A_sales',
  'B1_estimate_draft',
  'B2_estimate_review',
  'B3_estimate_sent',
  'B4_estimate_response',
  'C1_contract_draft',
  'C2_contract_review',
  'C3_contract_sent',
  'C4_contract_signed',
  'D1_payment_pending',
  'D2_payment_confirmed',
  'E1_prereport_draft',
  'E2_prereport_review',
  'E3_prereport_sent',
  'F1_execution',
  'G1_refund',
  'H1_closed',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** 상태 그룹 (단계 헤더용) */
export const PROJECT_STATUS_GROUPS: { key: string; label: string; statuses: ProjectStatus[] }[] = [
  { key: 'A', label: '영업', statuses: ['A_sales'] },
  { key: 'B', label: '견적', statuses: ['B1_estimate_draft', 'B2_estimate_review', 'B3_estimate_sent', 'B4_estimate_response'] },
  { key: 'C', label: '계약', statuses: ['C1_contract_draft', 'C2_contract_review', 'C3_contract_sent', 'C4_contract_signed'] },
  { key: 'D', label: '입금', statuses: ['D1_payment_pending', 'D2_payment_confirmed'] },
  { key: 'E', label: '보고서', statuses: ['E1_prereport_draft', 'E2_prereport_review', 'E3_prereport_sent'] },
  { key: 'F', label: '집행', statuses: ['F1_execution'] },
  { key: 'G', label: '환불', statuses: ['G1_refund'] },
  { key: 'H', label: '종료', statuses: ['H1_closed'] },
];

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; shortLabel: string; color: string; description: string }
> = {
  A_sales:              { label: 'A. 영업',                    shortLabel: '영업',         color: 'gray',    description: '고객 미팅 및 요구사항 파악' },
  B1_estimate_draft:    { label: 'B-1. 견적서 작성',           shortLabel: '견적 작성',     color: 'blue',    description: '견적서 초안 작성 중' },
  B2_estimate_review:   { label: 'B-2. 견적서 내부 승인',      shortLabel: '견적 승인',     color: 'yellow',  description: '견적서 내부 검토/승인 대기' },
  B3_estimate_sent:     { label: 'B-3. 견적서 전달',           shortLabel: '견적 전달',     color: 'indigo',  description: '고객에게 견적서 전달 완료' },
  B4_estimate_response: { label: 'B-4. 견적서 응답 수신',      shortLabel: '견적 응답',     color: 'cyan',    description: '고객의 견적 승인/반려 응답 수신' },
  C1_contract_draft:    { label: 'C-1. 계약서 작성',           shortLabel: '계약 작성',     color: 'blue',    description: '계약서 초안 작성 중' },
  C2_contract_review:   { label: 'C-2. 계약서 내부 승인',      shortLabel: '계약 승인',     color: 'yellow',  description: '계약서 내부 검토/승인 대기' },
  C3_contract_sent:     { label: 'C-3. 계약서 전달',           shortLabel: '계약 전달',     color: 'indigo',  description: '고객에게 계약서 전달 완료' },
  C4_contract_signed:   { label: 'C-4. 계약 체결',             shortLabel: '계약 체결',     color: 'emerald', description: '양측 서명 완료, 계약 확정' },
  D1_payment_pending:   { label: 'D-1. 입금 대기',             shortLabel: '입금 대기',     color: 'orange',  description: '고객 입금 대기 중' },
  D2_payment_confirmed: { label: 'D-2. 입금 확인',             shortLabel: '입금 확인',     color: 'emerald', description: '입금 확인 완료' },
  E1_prereport_draft:   { label: 'E-1. 집행 사전 보고서 작성',  shortLabel: '보고서 작성',   color: 'blue',    description: '집행 사전 보고서 작성 중' },
  E2_prereport_review:  { label: 'E-2. 집행 사전 보고서 승인',  shortLabel: '보고서 승인',   color: 'yellow',  description: '사전 보고서 내부 검토/승인 대기' },
  E3_prereport_sent:    { label: 'E-3. 집행 사전 보고서 전달',  shortLabel: '보고서 전달',   color: 'indigo',  description: '고객에게 사전 보고서 전달 완료' },
  F1_execution:         { label: 'F-1. 바이럴 및 광고 집행',    shortLabel: '집행',          color: 'green',   description: '바이럴 및 광고 마케팅 집행 중' },
  G1_refund:            { label: 'G-1. 환불 처리',              shortLabel: '환불',          color: 'red',     description: '고객 환불 처리 진행 중' },
  H1_closed:            { label: 'H-1. 프로젝트 종료',           shortLabel: '종료',          color: 'gray',    description: '프로젝트 완료 또는 종결' },
};

/**
 * 기본 상태 전환 맵
 *
 * key: 현재 상태, value: 전환 가능한 상태 목록
 * 프로젝트 서비스 유형에 따라 일부 단계는 건너뛸 수 있음.
 * (예: 바이럴은 C단계 생략, B4 → D1)
 */
export const PROJECT_STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  A_sales:              ['B1_estimate_draft', 'H1_closed'],
  B1_estimate_draft:    ['B2_estimate_review', 'G1_refund', 'H1_closed'],
  B2_estimate_review:   ['B3_estimate_sent', 'B1_estimate_draft', 'G1_refund', 'H1_closed'],
  B3_estimate_sent:     ['B4_estimate_response', 'G1_refund', 'H1_closed'],
  B4_estimate_response: ['C1_contract_draft', 'D1_payment_pending', 'A_sales', 'G1_refund', 'H1_closed'],
  C1_contract_draft:    ['C2_contract_review', 'G1_refund', 'H1_closed'],
  C2_contract_review:   ['C3_contract_sent', 'C1_contract_draft', 'G1_refund', 'H1_closed'],
  C3_contract_sent:     ['C4_contract_signed', 'G1_refund', 'H1_closed'],
  C4_contract_signed:   ['D1_payment_pending', 'G1_refund', 'H1_closed'],
  D1_payment_pending:   ['D2_payment_confirmed', 'G1_refund', 'H1_closed'],
  D2_payment_confirmed: ['E1_prereport_draft', 'F1_execution', 'G1_refund', 'H1_closed'],
  E1_prereport_draft:   ['E2_prereport_review', 'G1_refund', 'H1_closed'],
  E2_prereport_review:  ['E3_prereport_sent', 'E1_prereport_draft', 'G1_refund', 'H1_closed'],
  E3_prereport_sent:    ['F1_execution', 'G1_refund', 'H1_closed'],
  F1_execution:         ['E1_prereport_draft', 'G1_refund', 'H1_closed'],  // E1 루프, 환불, 또는 종료
  G1_refund:            ['H1_closed'],                                     // 환불 → 종료
  H1_closed:            [],                                                // 최종 상태 (전환 불가)
};

/**
 * 상태 전환 시 필요한 최소 역할
 */
export const PROJECT_TRANSITION_REQUIRED_ROLE: Partial<Record<ProjectStatus, UserRole>> = {
  B2_estimate_review:   'manager',
  C2_contract_review:   'manager',
  C4_contract_signed:   'manager',
  D2_payment_confirmed: 'manager',
  E2_prereport_review:  'manager',
  G1_refund:            'manager',
  H1_closed:            'manager',
};

// ============================================================================
// DOCUMENT STATUS
// ============================================================================

export const DOCUMENT_STATUSES = [
  'draft',
  'in_review',
  'approved',
  'rejected',
  'sent',
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_STATUS_META: Record<
  DocumentStatus,
  { label: string; color: string; description: string }
> = {
  draft: { label: '작성중', color: 'gray', description: '작성 중인 문서' },
  in_review: { label: '검토중', color: 'yellow', description: '승인 검토 중인 문서' },
  approved: { label: '승인됨', color: 'green', description: '승인 완료된 문서' },
  rejected: { label: '반려됨', color: 'red', description: '반려된 문서' },
  sent: { label: '발송됨', color: 'blue', description: '고객에게 발송된 문서' },
};

/**
 * 문서 상태 전환 맵
 */
export const DOCUMENT_STATUS_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ['in_review'],
  in_review: ['approved', 'rejected', 'draft'],
  approved: ['sent', 'draft'],
  rejected: ['draft'],
  sent: [],
};

// ============================================================================
// DOCUMENT TYPE
// ============================================================================

export const DOCUMENT_TYPES = [
  'estimate',
  'contract',
  'pre_report',
  'payment',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_META: Record<
  DocumentType,
  {
    label: string;
    description: string;
    allowedProjectStatuses: ProjectStatus[];
    allowedServiceTypes: ServiceType[] | null; // null = 모든 서비스 타입 허용
  }
> = {
  estimate: {
    label: '견적서',
    description: '고객에게 보내는 견적서',
    allowedProjectStatuses: ['B1_estimate_draft', 'B2_estimate_review', 'B3_estimate_sent'],
    allowedServiceTypes: null,
  },
  contract: {
    label: '계약서',
    description: '계약 체결을 위한 계약서',
    allowedProjectStatuses: ['C1_contract_draft', 'C2_contract_review', 'C3_contract_sent'],
    allowedServiceTypes: ['performance', 'viral_performance'],
  },
  pre_report: {
    label: '사전 보고서',
    description: '작업 시작 전 사전 보고서',
    allowedProjectStatuses: ['E1_prereport_draft', 'E2_prereport_review', 'E3_prereport_sent'],
    allowedServiceTypes: null,
  },
  payment: {
    label: '입금 확인',
    description: '입금 확인 기록',
    allowedProjectStatuses: ['D1_payment_pending', 'D2_payment_confirmed'],
    allowedServiceTypes: null,
  },
};

// ============================================================================
// SERVICE TYPE
// ============================================================================

export const SERVICE_TYPES = ['viral', 'performance', 'viral_performance'] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_META: Record<
  ServiceType,
  { label: string; description: string; requiresContract: boolean }
> = {
  viral: {
    label: '바이럴',
    description: '바이럴 마케팅 서비스',
    requiresContract: false,
  },
  performance: {
    label: '퍼포먼스',
    description: '퍼포먼스 마케팅 서비스',
    requiresContract: true,
  },
  viral_performance: {
    label: '바이럴+퍼포먼스',
    description: '바이럴+퍼포먼스 마케팅 서비스',
    requiresContract: true,
  },
};

// ============================================================================
// PAYMENT TYPE
// ============================================================================

export const PAYMENT_TYPES = ['per_invoice', 'monthly', 'deposit'] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_TYPE_META: Record<
  PaymentType,
  { label: string; description: string }
> = {
  deposit: { label: '선수금', description: '선수금 입금 후 작업 진행' },
  per_invoice: { label: '건별결제', description: '건별 청구서 발행 후 결제' },
  monthly: { label: '월결제', description: '월 단위 정기 결제' },
};

// ============================================================================
// CLIENT TIER
// ============================================================================

export const CLIENT_TIERS = ['regular', 'loyal'] as const;

export type ClientTier = (typeof CLIENT_TIERS)[number];

export const CLIENT_TIER_META: Record<
  ClientTier,
  { label: string; description: string }
> = {
  regular: { label: '일반', description: '일반 고객' },
  loyal: { label: '우수', description: '우수 고객' },
};

// ============================================================================
// APPROVAL ACTION
// ============================================================================

export const APPROVAL_ACTIONS = ['approve', 'reject', 'cancel'] as const;

export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

export const APPROVAL_ACTION_META: Record<
  ApprovalAction,
  { label: string; color: string }
> = {
  approve: { label: '승인', color: 'green' },
  reject: { label: '반려', color: 'red' },
  cancel: { label: '취소', color: 'gray' },
};

// ============================================================================
// USER ROLE
// ============================================================================

export const USER_ROLES = ['admin', 'manager', 'member'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_META: Record<
  UserRole,
  { label: string; level: number; description: string }
> = {
  admin: { label: '관리자', level: 100, description: '시스템 전체 관리 권한' },
  manager: { label: '매니저', level: 50, description: '프로젝트 관리 및 승인 권한' },
  member: { label: '멤버', level: 10, description: '기본 작업 권한' },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * 프로젝트 상태 전환 가능 여부 확인
 */
export function canTransitionProjectStatus(
  from: ProjectStatus,
  to: ProjectStatus,
): boolean {
  return PROJECT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * 상태 전환에 필요한 최소 역할 반환
 */
export function getRequiredRoleForTransition(toStatus: ProjectStatus): UserRole {
  return PROJECT_TRANSITION_REQUIRED_ROLE[toStatus] ?? 'member';
}

/**
 * 문서 상태 전환 가능 여부 확인
 */
export function canTransitionDocumentStatus(
  from: DocumentStatus,
  to: DocumentStatus,
): boolean {
  return DOCUMENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * 문서를 고객에게 발송할 수 있는지 여부
 * approved 상태인 문서만 발송 가능
 */
export function canSendDocument(status: DocumentStatus): boolean {
  return status === 'approved';
}

/**
 * 현재 프로젝트 상태와 서비스 타입에 따라 생성 가능한 문서 타입 반환
 */
export function getAllowedDocumentTypes(
  projectStatus: ProjectStatus,
  serviceType: ServiceType,
): DocumentType[] {
  return DOCUMENT_TYPES.filter((docType) => {
    const meta = DOCUMENT_TYPE_META[docType];
    if (!meta.allowedProjectStatuses.includes(projectStatus)) return false;
    if (meta.allowedServiceTypes !== null && !meta.allowedServiceTypes.includes(serviceType)) return false;
    return true;
  });
}

/**
 * 서비스 타입에 따라 프로젝트 상태 전환 경로를 필터링
 *
 * - requiresContract === true → B4→C1 경로 포함 (계약 단계 거침)
 * - requiresContract === false → B4→D1 직행 가능 (계약 생략)
 */
export function getProjectTransitionsForServiceType(
  currentStatus: ProjectStatus,
  serviceType: ServiceType,
): ProjectStatus[] {
  const transitions = PROJECT_STATUS_TRANSITIONS[currentStatus] ?? [];
  const meta = SERVICE_TYPE_META[serviceType];

  if (currentStatus === 'B4_estimate_response') {
    if (meta.requiresContract) {
      // 계약 필요: C1 허용, D1 직행 제외
      return transitions.filter((s) => s !== 'D1_payment_pending');
    } else {
      // 계약 불필요: D1 직행 허용, C1 제외
      return transitions.filter((s) => s !== 'C1_contract_draft');
    }
  }

  if (currentStatus === 'D2_payment_confirmed') {
    if (meta.requiresContract) {
      // 계약 유형: E1 사전보고서 필수
      return transitions.filter((s) => s !== 'F1_execution');
    } else {
      // 바이럴 전용: E4 직행 가능
      return transitions;
    }
  }

  return transitions;
}
