/**
 * Domain Types - Barrel Export
 *
 * 紐⑤ ?硫????? ?⑥?吏??.
 *
 * @example
 * import type { Project, CreateProjectInput, ProjectStatus } from '@/lib/domain/types';
 * import { PROJECT_STATUS_META, canTransitionProjectStatus } from '@/lib/domain/types';
 */

// Base
export type {
  BaseEntity,
  BaseImmutableEntity,
  OrgScopedEntity,
  JsonValue,
  JsonObject,
  WithRelation,
  CreateInput,
  UpdateInput,
  PaginationParams,
  PaginatedResult,
  ServiceResult,
} from './base.types';

// Status (types)
export type {
  ProjectStatus,
  DocumentStatus,
  DocumentType,
  ApprovalAction,
  UserRole,
  ServiceType,
  PaymentType,
  ClientTier,
} from './status.types';

// Status (constants & functions)
export {
  PROJECT_STATUSES,
  PROJECT_STATUS_META,
  PROJECT_STATUS_TRANSITIONS,
  PROJECT_TRANSITION_REQUIRED_ROLE,
  DOCUMENT_STATUSES,
  DOCUMENT_STATUS_META,
  DOCUMENT_STATUS_TRANSITIONS,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_META,
  APPROVAL_ACTIONS,
  APPROVAL_ACTION_META,
  USER_ROLES,
  USER_ROLE_META,
  SERVICE_TYPES,
  SERVICE_TYPE_META,
  PAYMENT_TYPES,
  PAYMENT_TYPE_META,
  CLIENT_TIERS,
  CLIENT_TIER_META,
  canTransitionProjectStatus,
  getRequiredRoleForTransition,
  canTransitionDocumentStatus,
  canSendDocument,
  getAllowedDocumentTypes,
  getProjectTransitionsForServiceType,
} from './status.types';

// Entities
export type {
  Organization,
  User,
  Client,
  Project,
  ProjectWithRelations,
  ProjectDocument,
  ProjectDocumentWithRelations,
  DocumentApproval,
  DocumentApprovalWithUsers,
  ActivityLog,
  ActivityLogWithActor,
  EstimateContent,
  ContractContent,
  PreReportContent,
  ReportContent,
  DocumentContentMap,
  TypedProjectDocument,
  ApprovalPolicy,
  ApprovalPolicyWithSteps,
  ApprovalPolicyStep,
  AssigneeRole,
  ProjectAssignee,
  ProjectAssigneeWithUser,
  NotificationType,
  Notification,
  NotificationWithProject,
} from './entities.types';

// DTOs
export type {
  CreateClientInput,
  UpdateClientInput,
  CreateProjectInput,
  UpdateProjectInput,
  TransitionProjectInput,
  CreateDocumentInput,
  CreateTypedDocumentInput,
  UpdateDocumentInput,
  UpdateTypedDocumentInput,
  SendDocumentInput,
  RequestApprovalInput,
  ProcessApprovalInput,
  CancelApprovalInput,
  CreateActivityLogInput,
  CreateUserInput,
  UpdateUserInput,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  CreateApprovalPolicyInput,
  UpdateApprovalPolicyInput,
  ProjectListFilter,
  DocumentListFilter,
  ActivityLogFilter,
  AddAssigneeInput,
  RemoveAssigneeInput,
  CreateNotificationInput,
} from './dto.types';
