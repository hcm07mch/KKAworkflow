/**
 * DTO (Data Transfer Object) ??
 *
 * ?????/????????鍮????댁???μ?
 * ??고???怨?遺由ы?ъ API 寃쎄?瑜?紐??寃 ??
 */

import type { JsonObject } from './base.types';
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
import type { DocumentContentMap } from './entities.types';

// ============================================================================
// CLIENT DTO
// ============================================================================

export interface CreateClientInput {
  name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  notes?: string;
  service_type: ServiceType;
  payment_type: PaymentType;
  tier?: ClientTier;
  metadata?: JsonObject;
}

export interface UpdateClientInput {
  name?: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  notes?: string | null;
  service_type?: ServiceType;
  payment_type?: PaymentType;
  tier?: ClientTier;
  metadata?: JsonObject;
  is_active?: boolean;
}

// ============================================================================
// PROJECT DTO
// ============================================================================

export interface CreateProjectInput {
  client_id: string;
  title: string;
  description?: string;
  code?: string;
  service_type: ServiceType;
  owner_id?: string;
  start_date?: string;
  end_date?: string;
  total_amount?: number;
  currency?: string;
  metadata?: JsonObject;
}

/** 湲곕낯 ?蹂??? (?? 蹂寃쎌 蹂? DTO) */
export interface UpdateProjectInput {
  title?: string;
  description?: string | null;
  code?: string | null;
  service_type?: ServiceType;
  owner_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  total_amount?: number | null;
  currency?: string;
  metadata?: JsonObject;
}

/** ?濡????? ????泥 */
export interface TransitionProjectInput {
  project_id: string;
  to_status: ProjectStatus;
  reason?: string;  // 蹂寃??ъ (activity_log? 湲곕?)
}

// ============================================================================
// PROJECT DOCUMENT DTO
// ============================================================================

/** 踰??臾몄 ???*/
export interface CreateDocumentInput {
  project_id: string;
  type: DocumentType;
  title: string;
  content?: JsonObject;
  metadata?: JsonObject;
}

/** ??蹂 臾몄 ???(?? ??) */
export interface CreateTypedDocumentInput<T extends DocumentType> {
  project_id: string;
  type: T;
  title: string;
  content?: DocumentContentMap[T];
  metadata?: JsonObject;
}

/** 臾몄 ?댁??? */
export interface UpdateDocumentInput {
  title?: string;
  content?: JsonObject;
  metadata?: JsonObject;
}

/** ??蹂 臾몄 ?? (?? ??) */
export interface UpdateTypedDocumentInput<T extends DocumentType> {
  title?: string;
  content?: Partial<DocumentContentMap[T]>;
  metadata?: JsonObject;
}

/** 臾몄 諛???泥 */
export interface SendDocumentInput {
  document_id: string;
  sent_to: string;  // 諛???? (?대?????
}

// ============================================================================
// DOCUMENT APPROVAL DTO
// ============================================================================

/** ?뱀??泥 */
export interface RequestApprovalInput {
  document_id: string;
  comment?: string;
}

/** ?뱀?諛??泥由?*/
export interface ProcessApprovalInput {
  approval_id: string;
  comment?: string;
}

/** ?뱀??泥 痍⑥ */
export interface CancelApprovalInput {
  approval_id: string;
  comment?: string;
}

// ============================================================================
// APPROVAL POLICY DTO
// ============================================================================

/** ?뱀??梨 ???*/
export interface CreateApprovalPolicyInput {
  document_type?: DocumentType;
  required_steps: number;
  description?: string;
  steps: {
    step: number;
    required_role: UserRole;
    label?: string;
    assigned_user_id?: string;
  }[];
}

/** ?뱀??梨 ?? */
export interface UpdateApprovalPolicyInput {
  required_steps?: number;
  description?: string;
  is_active?: boolean;
  steps?: {
    step: number;
    required_role: UserRole;
    label?: string;
    assigned_user_id?: string;
  }[];
}

// ============================================================================
// ACTIVITY LOG DTO
// ============================================================================

/** ?대?湲곕? (?鍮????댁??대? ?ъ? */
export interface CreateActivityLogInput {
  entity_type: string;
  entity_id: string;
  project_id?: string;
  action: string;
  actor_id?: string;
  description?: string;
  old_data?: JsonObject;
  new_data?: JsonObject;
  metadata?: JsonObject;
}

// ============================================================================
// USER DTO
// ============================================================================

export interface CreateUserInput {
  email: string;
  name: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  is_active?: boolean;
}

// ============================================================================
// ORGANIZATION DTO
// ============================================================================

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  settings?: JsonObject;
}

export interface UpdateOrganizationInput {
  name?: string;
  settings?: JsonObject;
}

// ============================================================================
// QUERY / FILTER DTO
// ============================================================================

/** ?濡???紐⑸? ???*/
export interface ProjectListFilter {
  status?: ProjectStatus | ProjectStatus[];
  service_type?: ServiceType | ServiceType[];
  client_id?: string;
  owner_id?: string;
  search?: string;  // title, code 寃?
  start_date_from?: string;
  start_date_to?: string;
}

/** 臾몄 紐⑸? ???*/
export interface DocumentListFilter {
  project_id?: string;
  type?: DocumentType | DocumentType[];
  status?: DocumentStatus | DocumentStatus[];
  is_sent?: boolean;
  created_by?: string;
}

/** ?? ?대????*/
export interface ActivityLogFilter {
  entity_type?: string;
  entity_id?: string;
  project_id?: string;
  actor_id?: string;
  action?: string;
  date_from?: string;
  date_to?: string;
}

// ============================================================================
// PROJECT ASSIGNEE DTO
// ============================================================================

export interface AddAssigneeInput {
  project_id: string;
  user_id: string;
  role?: 'owner' | 'member';
}

export interface RemoveAssigneeInput {
  project_id: string;
  user_id: string;
}

// ============================================================================
// NOTIFICATION DTO
// ============================================================================

export interface CreateNotificationInput {
  recipient_id: string;
  project_id?: string;
  type: 'project_status_changed' | 'document_created' | 'approval_requested' | 'approval_completed' | 'assignee_added';
  title: string;
  body?: string;
  link?: string;
}
