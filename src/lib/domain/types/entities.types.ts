/**
 * ?硫????고???
 *
 * Supabase ??대? row? 1:1 ??.
 * ?鍮????댁댁 ?濡?몄? ?履쎌? 怨듭?
 */

import type { BaseEntity, BaseImmutableEntity, OrgScopedEntity, JsonObject } from './base.types';
import type {
  ProjectStatus,
  DocumentStatus,
  DocumentType,
  ApprovalAction,
  UserRole,
  ServiceType,
  PaymentType,
  ClientTier,
} from './status.types';

// ============================================================================
// ORGANIZATION
// ============================================================================

export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  settings: JsonObject;
}

// ============================================================================
// USER
// ============================================================================

export interface User extends OrgScopedEntity {
  auth_id: string | null;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
}

// ============================================================================
// CLIENT
// ============================================================================

export interface Client extends OrgScopedEntity {
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  notes: string | null;
  service_type: ServiceType;       // 留耳? ?鍮????
  payment_type: PaymentType;       // 寃곗 諛⑹
  tier: ClientTier;                // 怨媛 ?깃?
  metadata: JsonObject;
  is_active: boolean;
}

// ============================================================================
// PROJECT (以????고?
// ============================================================================

export interface Project extends OrgScopedEntity {
  client_id: string;
  title: string;
  description: string | null;
  code: string | null;
  status: ProjectStatus;
  service_type: ServiceType;       // ?鍮???? (怨媛?? ?? 媛?? ?濡??몃? 吏?? 媛??
  owner_id: string | null;
  start_date: string | null;  // YYYY-MM-DD
  end_date: string | null;    // YYYY-MM-DD
  total_amount: number | null;
  currency: string;
  metadata: JsonObject;
}

/** Project + ?곌? ?곗댄?議고 ? */
export interface ProjectWithRelations extends Project {
  client: Client;
  owner: User | null;
  documents: ProjectDocument[];
}

// ============================================================================
// PROJECT DOCUMENT
// ============================================================================

export interface ProjectDocument extends BaseEntity {
  project_id: string;
  type: DocumentType;
  status: DocumentStatus;
  version: number;
  title: string;
  content: JsonObject;
  is_sent: boolean;
  sent_at: string | null;
  sent_by: string | null;
  sent_to: string | null;
  created_by: string | null;
  metadata: JsonObject;
}

/** Document + ?곌? ?곗댄?議고 ? */
export interface ProjectDocumentWithRelations extends ProjectDocument {
  project: Project;
  creator: User | null;
  sender: User | null;
  approvals: DocumentApproval[];
  latest_approval: DocumentApproval | null;
}

// ============================================================================
// DOCUMENT APPROVAL
// ============================================================================

/**
 * ?뱀??대μ immutable (INSERT only).
 * updated_at ??.
 */
export interface DocumentApproval extends BaseImmutableEntity {
  document_id: string;
  requested_by: string | null;
  requested_at: string;
  approver_id: string | null;
  action: ApprovalAction | null;  // null = ?湲?以
  actioned_at: string | null;
  step: number;
  comment: string | null;
  metadata: JsonObject;
}

/** Approval + ?ъ⑹ ?蹂?*/
export interface DocumentApprovalWithUsers extends DocumentApproval {
  requester: User | null;
  approver: User | null;
}

// ============================================================================
// APPROVAL POLICY (?ㅻ④? ?뱀??梨)
// ============================================================================

/** 議곗?蹂쨌臾몄??蹂 ?뱀??④? ?梨 */
export interface ApprovalPolicy extends BaseEntity {
  organization_id: string;
  document_type: DocumentType | null; // null = 議곗? 湲곕낯 ?梨
  required_steps: number;
  description: string | null;
  is_active: boolean;
}

/** ?梨 + ?④?蹂 ?ㅼ ?ы?*/
export interface ApprovalPolicyWithSteps extends ApprovalPolicy {
  steps: ApprovalPolicyStep[];
}

/** ?뱀??梨? 媛蹂 ?④? ?ㅼ */
export interface ApprovalPolicyStep {
  id: string;
  policy_id: string;
  step: number;
  required_role: UserRole;
  label: string | null;          // UI ??紐 (?: '????뱀?, '?? ?뱀?)
  assigned_user_id: string | null; // ?뱀 ?ъ⑹ 吏? (null = ?? 湲곕?)
  created_at: string;
}

// ============================================================================
// ACTIVITY LOG
// ============================================================================

/**
 * ?? ?대μ immutable (INSERT only).
 * updated_at ??.
 */
export interface ActivityLog extends BaseImmutableEntity {
  organization_id: string;
  entity_type: string;
  entity_id: string;
  project_id: string | null;
  action: string;
  actor_id: string | null;
  description: string | null;
  old_data: JsonObject | null;
  new_data: JsonObject | null;
  metadata: JsonObject;
}

/** ActivityLog + actor ?蹂?*/
export interface ActivityLogWithActor extends ActivityLog {
  actor: User | null;
}

// ============================================================================
// PROJECT ASSIGNEE (?濡????대뱀)
// ============================================================================

export type AssigneeRole = 'owner' | 'member';

export interface ProjectAssignee {
  id: string;
  project_id: string;
  user_id: string;
  role: AssigneeRole;
  assigned_at: string;
  assigned_by: string | null;
}

/** Assignee + ?ъ⑹ ?蹂?*/
export interface ProjectAssigneeWithUser extends ProjectAssignee {
  user: User;
}

// ============================================================================
// NOTIFICATION (?由?
// ============================================================================

export type NotificationType =
  | 'project_status_changed'
  | 'document_created'
  | 'approval_requested'
  | 'approval_completed'
  | 'assignee_added';

export interface Notification {
  id: string;
  organization_id: string;
  recipient_id: string;
  project_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

/** Notification + ?곌? ?濡????蹂?*/
export interface NotificationWithProject extends Notification {
  project: Pick<Project, 'id' | 'title' | 'code' | 'status'> | null;
}

// ============================================================================
// 臾몄 content ??蹂 ?? (而ㅼㅽ ????ъ명?
// ============================================================================

/**
 * 臾몄 ??蹂 content JSON? 湲곕낯 援ъ“.
 * ?ㅼ ??? ??щ?濡 ???
 * 肄?댁?? 鍮 ?명고?댁ㅻ? ?怨, 而ㅼㅽ ??댁댁? extend.
 */

/** 견적서 content */
export interface EstimateContent {
  /** 기본 정보 */
  document_number?: string;       // 문서번호 (KKA-2026-0401-001)
  recipient?: string;             // 수신 (고객사명 귀하)
  sender?: string;                // 발신 (자사명)
  project_name?: string;          // 프로젝트명
  contract_period?: string;       // 계약기간
  issued_date?: string;           // 작성일자 (YYYY-MM-DD)

  /** 상세 견적 내역 — 카테고리 기반 */
  items?: Array<{
    no: number;
    category: string;             // 카테고리 (예: 네이버 SA 대행)
    details: Array<{
      title: string;              // 세부 항목 제목
      descriptions: string[];     // 세부 설명 (bullet)
    }>;
    unit_price: number;           // 단가 (월)
    note?: string;                // 비고
    options?: Array<{
      name: string;               // 옵션명 (예: 리포트 추가 제공)
      price: number;              // 옵션 가격
    }>;
  }>;

  /** 금액 */
  subtotal?: number;              // 공급가액 (부가세 제외)
  tax_rate?: number;              // 세율 (기본 10)
  tax?: number;                   // 부가세
  total?: number;                 // 총 결제금액 (VAT 포함)

  /** 참고 사항 */
  notes?: string[];               // 하단 참고 사항 리스트
  valid_until?: string;           // YYYY-MM-DD

  /** 회사 정보 (footer) */
  company_name?: string;
  company_address?: string;
  company_representative?: string;

  [key: string]: unknown;
}

/** 怨?쎌 content */
export interface ContractContent {
  terms?: string;
  special_conditions?: string;
  contract_date?: string;
  effective_date?: string;
  expiry_date?: string;
  [key: string]: unknown;
}

/** 吏? ?ъ 蹂닿?? content */
export interface PreReportContent {
  platform?: string;
  objective?: string;
  budget?: number;
  schedule_start?: string;
  schedule_end?: string;
  target_audience?: string;
  /** 吏? ?? ?? 紐⑸? */
  tasks?: Array<{
    name: string;
    description?: string;
    quantity?: number;
    unit_price?: number;
    amount?: number;
  }>;
  total_budget?: number;
  notes?: string;
  [key: string]: unknown;
}

/** 蹂닿?? content */
export interface ReportContent {
  period_start?: string;
  period_end?: string;
  summary?: string;
  metrics?: Record<string, number>;
  [key: string]: unknown;
}

/**
 * 臾몄 ?? ? content ?? 留ㅽ
 */
export interface DocumentContentMap {
  estimate: EstimateContent;
  contract: ContractContent;
  pre_report: PreReportContent;
  report: ReportContent;
}

/**
 * ?? ??? 臾몄 (??ㅻ┃)
 *
 * @example
 * const estimate: TypedProjectDocument<'estimate'> = ...;
 * estimate.content.items  // OK - EstimateContent ??
 */
export interface TypedProjectDocument<T extends DocumentType> extends Omit<ProjectDocument, 'type' | 'content'> {
  type: T;
  content: DocumentContentMap[T];
}
