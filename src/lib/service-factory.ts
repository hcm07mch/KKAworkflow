/**
 * Service Factory
 *
 * ?鍮???몄ㅽ댁???깆 以??.
 * Repository 援ы泥?二쇱 + 而⑦?ㅽ?org, user) 諛?몃?
 *
 * API Route??:
 *   const { projectService, documentService, approvalService } = createServices(supabase, ctx);
 */

import type { SupabaseClient } from '@/lib/infrastructure/supabase';
import {
  SupabaseClientRepository,
  SupabaseProjectRepository,
  SupabaseDocumentRepository,
  SupabaseApprovalRepository,
  SupabaseApprovalPolicyRepository,
  SupabaseActivityLogRepository,
  SupabaseNotificationRepository,
  SupabaseProjectAssigneeRepository,
} from '@/lib/infrastructure/supabase';
import { ActivityLogService } from '@/lib/domain/services';
import { ProjectService } from '@/lib/domain/services';
import { DocumentService } from '@/lib/domain/services';
import { ApprovalService } from '@/lib/domain/services';
import { NotificationService } from '@/lib/domain/services';

interface ServiceContext {
  organizationId: string;
}

// NOTE: @supabase/ssr v0.5.x ? supabase-js v2.100+ ?ъ???ㅻ┃ ??쇰명?? 遺?쇱?濡
// SSR ?대쇱댁명몃? 吏? ??? ? ??. ?고? API? ??쇳誘濡 `any` ?ъ?
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createServices(db: any, ctx: ServiceContext) {
  // Repositories
  const clientRepo = new SupabaseClientRepository(db);
  const projectRepo = new SupabaseProjectRepository(db);
  const documentRepo = new SupabaseDocumentRepository(db);
  const approvalRepo = new SupabaseApprovalRepository(db);
  const approvalPolicyRepo = new SupabaseApprovalPolicyRepository(db);
  const activityLogRepo = new SupabaseActivityLogRepository(db);
  const notificationRepo = new SupabaseNotificationRepository(db);
  const assigneeRepo = new SupabaseProjectAssigneeRepository(db);

  // Core Services
  const activityLog = new ActivityLogService(activityLogRepo, ctx.organizationId);
  const projectService = new ProjectService(projectRepo, clientRepo, activityLog);
  const documentService = new DocumentService(documentRepo, projectRepo, activityLog);
  const approvalService = new ApprovalService(approvalRepo, documentRepo, approvalPolicyRepo, documentService, activityLog);
  const notificationService = new NotificationService(notificationRepo, assigneeRepo, ctx.organizationId);

  return {
    // Repositories (吏? ?洹쇱???? 寃쎌?
    clientRepo,
    projectRepo,
    documentRepo,
    approvalRepo,
    approvalPolicyRepo,
    assigneeRepo,

    // Services
    activityLog,
    projectService,
    documentService,
    approvalService,
    notificationService,
  };
}
