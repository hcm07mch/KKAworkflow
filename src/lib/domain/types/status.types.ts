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
  'draft',
  'quoted',
  'rejected',
  'contracted',
  'paid',
  'running',
  'paused',
  'completed',
  'refunded',
  'cancelled',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; color: string; description: string }
> = {
  draft: { label: '초안', color: 'gray', description: '작성 중인 프로젝트' },
  quoted: { label: '견적완료', color: 'blue', description: '견적서가 발송된 상태' },
  rejected: { label: '반려', color: 'red', description: '고객이 거절한 상태' },
  contracted: { label: '계약완료', color: 'indigo', description: '계약서가 체결된 상태' },
  paid: { label: '입금완료', color: 'emerald', description: '입금이 확인된 상태' },
  running: { label: '진행중', color: 'orange', description: '작업이 진행 중인 상태' },
  paused: { label: '일시중지', color: 'yellow', description: '일시 중지된 상태' },
  completed: { label: '완료', color: 'green', description: '프로젝트가 완료된 상태' },
  refunded: { label: '환불처리', color: 'pink', description: '환불 처리된 상태' },
  cancelled: { label: '취소', color: 'slate', description: '프로젝트가 취소된 상태' },
};

/**
 * 프로젝트 상태 전환 맵
 *
 * key: 현재 상태, value: 전환 가능한 상태 목록
 * 계약 기반(contracted) 경로와 바이럴(quoted→paid) 경로가 나뉨.
 */
export const PROJECT_STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  draft: ['quoted', 'cancelled'],
  quoted: ['contracted', 'paid', 'rejected', 'cancelled'],
  rejected: ['quoted', 'cancelled'],
  contracted: ['paid', 'cancelled'],
  paid: ['running', 'refunded', 'cancelled'],
  running: ['paused', 'completed', 'cancelled'],
  paused: ['running', 'cancelled'],
  completed: [],
  refunded: [],
  cancelled: [],
};

/**
 * 상태 전환 시 필요한 최소 역할
 */
export const PROJECT_TRANSITION_REQUIRED_ROLE: Partial<Record<ProjectStatus, UserRole>> = {
  contracted: 'manager',
  paid: 'manager',
  running: 'manager',
  completed: 'manager',
  refunded: 'admin',
  cancelled: 'admin',
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
  in_review: ['approved', 'rejected'],
  approved: ['sent'],
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
  'report',
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
    allowedProjectStatuses: ['draft', 'quoted', 'rejected'],
    allowedServiceTypes: null,
  },
  contract: {
    label: '계약서',
    description: '계약 체결을 위한 계약서',
    allowedProjectStatuses: ['quoted', 'contracted'],
    allowedServiceTypes: ['performance', 'viral_performance'],
  },
  pre_report: {
    label: '사전 보고서',
    description: '작업 시작 전 사전 보고서',
    allowedProjectStatuses: ['paid', 'running'],
    allowedServiceTypes: ['viral', 'viral_performance'],
  },
  report: {
    label: '보고서',
    description: '작업 완료 후 보고서',
    allowedProjectStatuses: ['running', 'completed'],
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

export const PAYMENT_TYPES = ['deposit', 'per_invoice'] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_TYPE_META: Record<
  PaymentType,
  { label: string; description: string }
> = {
  deposit: { label: '선입금', description: '선입금 후 작업 진행' },
  per_invoice: { label: '건별결제', description: '건별 청구서 발행 후 결제' },
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
 * - requiresContract === true → quoted→contracted 경로 포함
 * - requiresContract === false → quoted→paid 경로 포함 (contracted 스킵)
 */
export function getProjectTransitionsForServiceType(
  currentStatus: ProjectStatus,
  serviceType: ServiceType,
): ProjectStatus[] {
  const transitions = PROJECT_STATUS_TRANSITIONS[currentStatus] ?? [];
  const meta = SERVICE_TYPE_META[serviceType];

  if (currentStatus === 'quoted') {
    if (meta.requiresContract) {
      // 계약 필요: contracted 허용, paid 직행 제외
      return transitions.filter((s) => s !== 'paid');
    } else {
      // 계약 불필요: paid 직행 허용, contracted 제외
      return transitions.filter((s) => s !== 'contracted');
    }
  }

  return transitions;
}
