/**
 * Repository ?명고?댁?
 *
 * ?鍮????댁댁 ?곗댄??洹???댁댁 寃쎄?.
 * ?ㅼ 援ы(Supabase)? infrastructure ??댁댁? ?대?
 *
 * ?ㅺ? ?移:
 * - Read/Write 硫??瑜???? ?명고?댁ㅼ ??, ?쇰━??쇰? 援щ?
 * - 紐⑸? 議고? filter + pagination? 吏?
 * - ?④굔 議고 ?ㅽ?? null 諛? (?????)
 * - ?곌린 ??? ?????? ??고곕? 諛?
 */

import type {
  Project,
  ProjectWithRelations,
  ProjectDocument,
  ProjectDocumentWithRelations,
  DocumentApproval,
  DocumentApprovalWithUsers,
  ApprovalPolicyWithSteps,
  ActivityLog,
  ActivityLogWithActor,
  Client,
  User,
  JsonObject,
  PaginationParams,
  PaginatedResult,
  ProjectAssignee,
  ProjectAssigneeWithUser,
  Notification,
  NotificationWithProject,
} from '../types';
import type {
  ProjectStatus,
  DocumentStatus,
  DocumentType,
  ApprovalAction,
  ProjectListFilter,
  DocumentListFilter,
  ActivityLogFilter,
} from '../types';

// ============================================================================
// CLIENT REPOSITORY
// ============================================================================

export interface IClientRepository {
  // -- Read ------------------------------------------------------------------
  findById(id: string): Promise<Client | null>;
  findByOrganizationId(organizationId: string): Promise<Client[]>;
  findActiveByOrganizationId(organizationId: string): Promise<Client[]>;

  // -- Write -----------------------------------------------------------------
  create(data: {
    organization_id: string;
    name: string;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    address?: string | null;
    notes?: string | null;
    service_type?: string;
    payment_type?: string;
    tier?: string;
    metadata?: JsonObject;
  }): Promise<Client>;
  update(id: string, data: Partial<{
    name: string;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    address: string | null;
    notes: string | null;
    service_type: string;
    payment_type: string;
    tier: string;
    metadata: JsonObject;
    is_active: boolean;
  }>): Promise<Client>;
}

// ============================================================================
// PROJECT REPOSITORY
// ============================================================================

export interface IProjectRepository {
  // -- Read (?④굔) -----------------------------------------------------------
  findById(id: string): Promise<Project | null>;
  findByIdWithRelations(id: string): Promise<ProjectWithRelations | null>;

  // -- Read (紐⑸?) -----------------------------------------------------------
  findByOrganizationId(
    organizationId: string,
    filter?: ProjectListFilter,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<Project>>;

  findByClientId(clientId: string): Promise<Project[]>;

  // -- Write -----------------------------------------------------------------
  create(data: {
    organization_id: string;
    client_id: string;
    title: string;
    description?: string | null;
    code?: string | null;
    status?: ProjectStatus;
    service_type?: string;
    payment_type?: string;
    owner_id?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    total_amount?: number | null;
    currency?: string;
    metadata?: JsonObject;
  }): Promise<Project>;

  update(id: string, data: Partial<{
    title: string;
    description: string | null;
    code: string | null;
    status: ProjectStatus;
    service_type: string;
    payment_type: string;
    owner_id: string | null;
    start_date: string | null;
    end_date: string | null;
    total_amount: number | null;
    currency: string;
    metadata: JsonObject;
  }>): Promise<Project>;
}

// ============================================================================
// DOCUMENT REPOSITORY
// ============================================================================

export interface IDocumentRepository {
  // -- Read (?④굔) -----------------------------------------------------------
  findById(id: string): Promise<ProjectDocument | null>;
  findByIdWithRelations(id: string): Promise<ProjectDocumentWithRelations | null>;

  // -- Read (紐⑸?) -----------------------------------------------------------
  findByProjectId(
    projectId: string,
    filter?: Omit<DocumentListFilter, 'project_id'>,
  ): Promise<ProjectDocument[]>;

  findByOrganizationId(
    organizationId: string,
    filter?: DocumentListFilter,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<ProjectDocument>>;

  // -- Read (吏怨) -----------------------------------------------------------
  countByProjectIdAndType(projectId: string, type: DocumentType): Promise<number>;

  // -- Write -----------------------------------------------------------------
  create(data: {
    project_id: string;
    type: DocumentType;
    title: string;
    status?: DocumentStatus;
    version?: number;
    content?: JsonObject;
    created_by?: string | null;
    metadata?: JsonObject;
  }): Promise<ProjectDocument>;

  update(id: string, data: Partial<{
    title: string;
    status: DocumentStatus;
    version: number;
    content: JsonObject;
    is_sent: boolean;
    sent_at: string | null;
    sent_by: string | null;
    sent_to: string | null;
    metadata: JsonObject;
  }>): Promise<ProjectDocument>;

  deleteByProjectIdAndType(projectId: string, type: DocumentType): Promise<number>;
  deleteById(id: string): Promise<void>;
}

// ============================================================================
// APPROVAL REPOSITORY
// ============================================================================

export interface IApprovalRepository {
  // -- Read (?④굔) -----------------------------------------------------------
  findById(id: string): Promise<DocumentApproval | null>;
  findPendingByDocumentId(documentId: string): Promise<DocumentApproval | null>;

  // -- Read (紐⑸?) -----------------------------------------------------------
  findByDocumentId(documentId: string): Promise<DocumentApproval[]>;
  findByDocumentIdWithUsers(documentId: string): Promise<DocumentApprovalWithUsers[]>;

  // -- Write -----------------------------------------------------------------
  create(data: {
    document_id: string;
    requested_by?: string | null;
    requested_at?: string;
    step?: number;
    comment?: string | null;
    metadata?: JsonObject;
  }): Promise<DocumentApproval>;

  update(id: string, data: Partial<{
    approver_id: string | null;
    action: ApprovalAction | null;
    actioned_at: string | null;
    comment: string | null;
  }>): Promise<DocumentApproval>;
}

// ============================================================================
// APPROVAL POLICY REPOSITORY
// ============================================================================

export interface IApprovalPolicyRepository {
  // -- Read ------------------------------------------------------------------
  /** 議곗? + 臾몄 ?? ????梨 議고 (document_type = null?대㈃ 議곗? 湲곕낯 ?梨) */
  findByOrgAndType(
    organizationId: string,
    documentType: string | null,
  ): Promise<ApprovalPolicyWithSteps | null>;

  findByIdWithSteps(id: string): Promise<ApprovalPolicyWithSteps | null>;

  findByOrganizationId(organizationId: string): Promise<ApprovalPolicyWithSteps[]>;

  // -- Write -----------------------------------------------------------------
  create(data: {
    organization_id: string;
    document_type?: string | null;
    required_steps: number;
    description?: string | null;
    is_active?: boolean;
    steps: { step: number; required_role: string; label?: string | null; assigned_user_id?: string | null }[];
  }): Promise<ApprovalPolicyWithSteps>;

  update(id: string, data: Partial<{
    required_steps: number;
    description: string | null;
    is_active: boolean;
  }>): Promise<ApprovalPolicyWithSteps>;

  delete(id: string): Promise<void>;
}

// ============================================================================
// ACTIVITY LOG REPOSITORY
// ============================================================================

export interface IActivityLogRepository {
  // -- Read ------------------------------------------------------------------
  findByEntity(
    entityType: string,
    entityId: string,
    pagination?: PaginationParams,
  ): Promise<ActivityLog[]>;

  findByProjectId(
    projectId: string,
    pagination?: PaginationParams,
  ): Promise<ActivityLog[]>;

  findByOrganizationId(
    organizationId: string,
    filter?: ActivityLogFilter,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<ActivityLogWithActor>>;

  // -- Write (INSERT only - ?대μ ??/?? 遺媛) ---------------------------
  create(data: {
    organization_id: string;
    entity_type: string;
    entity_id: string;
    project_id?: string | null;
    action: string;
    actor_id?: string | null;
    description?: string | null;
    old_data?: JsonObject | null;
    new_data?: JsonObject | null;
    metadata?: JsonObject;
  }): Promise<ActivityLog>;
}

// ============================================================================
// USER REPOSITORY
// ============================================================================

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByAuthId(authId: string): Promise<User | null>;
  findByOrganizationId(organizationId: string): Promise<User[]>;
}

// ============================================================================
// PROJECT ASSIGNEE REPOSITORY
// ============================================================================

export interface IProjectAssigneeRepository {
  findByProjectId(projectId: string): Promise<ProjectAssigneeWithUser[]>;
  findByUserId(userId: string): Promise<ProjectAssignee[]>;
  add(data: {
    project_id: string;
    user_id: string;
    role?: string;
    assigned_by?: string | null;
  }): Promise<ProjectAssignee>;
  remove(projectId: string, userId: string): Promise<void>;
}

// ============================================================================
// NOTIFICATION REPOSITORY
// ============================================================================

export interface INotificationRepository {
  findByRecipientId(
    recipientId: string,
    pagination?: PaginationParams,
  ): Promise<NotificationWithProject[]>;

  countUnread(recipientId: string): Promise<number>;

  markAsRead(id: string): Promise<Notification>;
  markAllAsRead(recipientId: string): Promise<void>;

  create(data: {
    organization_id: string;
    recipient_id: string;
    project_id?: string | null;
    type: string;
    title: string;
    body?: string | null;
    link?: string | null;
  }): Promise<Notification>;
}
