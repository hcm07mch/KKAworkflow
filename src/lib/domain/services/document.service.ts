/**
 * Document Service
 *
 * 프로젝트 문서의 생성, 수정, 발송 비즈니스 로직을 담당합니다.
 * 핵심 규칙: 문서의 발송은 Project와 무관하게, 승인되지 않은 문서는 발송 불가.
 */

import type {
  ProjectDocument,
  DocumentStatus,
  ServiceResult,
} from '../types';
import type {
  CreateDocumentInput,
  UpdateDocumentInput,
  SendDocumentInput,
} from '../types';
import {
  canTransitionDocumentStatus,
  canSendDocument,
  DOCUMENT_STATUS_META,
  DOCUMENT_TYPE_META,
} from '../types';
import type { IProjectRepository, IDocumentRepository } from '../repositories/interfaces';
import type { ActivityLogService } from './activity-log.service';

interface DocumentServiceContext {
  userId: string;
  userRole: 'admin' | 'manager' | 'member';
  organizationId: string;
}

/**
 * 문서번호 생성 (KKA-YYYY-MMDD-NNN 형식).
 * 생성 시각 기반이므로 같은 문서에 대해 한 번만 생성되어 모든 조회자에게
 * 동일한 값으로 노출된다. NNN 은 시각의 초·밀리초를 압축한 3자리.
 */
function generateStableDocNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  // 초(0~59) * 1000 + 밀리초(0~999) → 4자리 → 마지막 3자리만 사용 (충돌 가능성 낮음)
  const seq = String((now.getSeconds() * 1000 + now.getMilliseconds()) % 1000).padStart(3, '0');
  return `KKA-${y}-${m}${d}-${seq}`;
}

export class DocumentService {
  constructor(
    private readonly documentRepo: IDocumentRepository,
    private readonly projectRepo: IProjectRepository,
    private readonly activityLog: ActivityLogService,
  ) {}

  // --------------------------------------------------------------------------
  // createProjectDocument
  // --------------------------------------------------------------------------
  /**
   * 프로젝트 문서 생성
   *
   * 비즈니스 규칙:
   * 1. project_id가 존재하는지 검증 (문서의 발송은 프로젝트와 무관)
   * 2. 현재 프로젝트 상태에서 이 타입의 문서를 생성할 수 있는지 검증
   * 3. 초기 상태는 반드시 'draft'
   * 4. 성공 시 activity_logs에 기록
   */
  async createProjectDocument(
    input: CreateDocumentInput,
    ctx: DocumentServiceContext,
  ): Promise<ServiceResult<ProjectDocument>> {
    // [단계 1] 프로젝트 존재 검증
    const project = await this.projectRepo.findById(input.project_id);
    if (!project) {
      return {
        success: false,
        error: { code: 'PROJECT_NOT_FOUND', message: '프로젝트를 찾을 수 없습니다' },
      };
    }

    // [단계 2] 프로젝트 상태에서 문서 타입 생성 가능 여부 검증
    const typeMeta = DOCUMENT_TYPE_META[input.type];
    if (!typeMeta.allowedProjectStatuses.includes(project.status)) {
      return {
        success: false,
        error: {
          code: 'DOCUMENT_TYPE_NOT_ALLOWED',
          message: `현재 프로젝트 상태(${project.status})에서는 ${typeMeta.label}를(을) 생성할 수 없습니다`,
        },
      };
    }

    // [단계 3] 초기 상태는 반드시 draft
    //   document_number 가 content 에 없으면 서버에서 결정적으로 생성하여 영속화한다.
    //   이렇게 해야 본사/지사 등 여러 사용자가 같은 문서를 열 때 서로 다른 번호가
    //   보이는 문제(에디터의 random fallback 으로 인한 분기)를 방지할 수 있다.
    const incomingContent = (input.content ?? {}) as Record<string, unknown>;
    const needsDocNumber = ['estimate', 'contract', 'pre_report', 'report'].includes(input.type);
    const finalContent: Record<string, unknown> = needsDocNumber && !incomingContent.document_number
      ? { ...incomingContent, document_number: generateStableDocNumber() }
      : incomingContent;

    const document = await this.documentRepo.create({
      project_id: input.project_id,
      type: input.type,
      title: input.title,
      status: 'draft',
      version: 1,
      content: finalContent,
      created_by: ctx.userId,
      metadata: input.metadata ?? {},
    });

    // [단계 4] 생성 활동 로그 기록
    await this.activityLog.log({
      entity_type: 'document',
      entity_id: document.id,
      project_id: input.project_id,
      action: 'created',
      actor_id: ctx.userId,
      description: `${typeMeta.label} "${document.title}" 생성`,
      new_data: { type: document.type, status: document.status },
    });

    return { success: true, data: document };
  }

  // --------------------------------------------------------------------------
  // updateProjectDocument
  // --------------------------------------------------------------------------
  /**
   * 프로젝트 문서 수정
   *
   * 비즈니스 규칙:
   * 1. 문서가 존재하는지 검증
   * 2. draft 또는 rejected 상태에서만 수정 가능
   * 3. sent 된 문서는 수정 자체 불가
   * 4. 수정 시 activity_logs에 기록
   */
  async updateProjectDocument(
    documentId: string,
    input: UpdateDocumentInput,
    ctx: DocumentServiceContext,
  ): Promise<ServiceResult<ProjectDocument>> {
    // [단계 1] 문서 존재 검증
    const existing = await this.documentRepo.findById(documentId);
    if (!existing) {
      return {
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: '문서를 찾을 수 없습니다' },
      };
    }

    // [단계 2, 3] 수정 가능 여부 검증
    const editableStatuses: DocumentStatus[] = ['draft', 'rejected'];
    if (!editableStatuses.includes(existing.status)) {
      return {
        success: false,
        error: {
          code: 'DOCUMENT_NOT_EDITABLE',
          message: `${DOCUMENT_STATUS_META[existing.status].label} 상태의 문서는 수정할 수 없습니다`,
        },
      };
    }

    const updated = await this.documentRepo.update(documentId, {
      title: input.title,
      content: input.content,
      metadata: input.metadata,
    });

    // [단계 4] 수정 활동 로그 기록
    await this.activityLog.log({
      entity_type: 'document',
      entity_id: documentId,
      project_id: existing.project_id,
      action: 'updated',
      actor_id: ctx.userId,
      description: '문서 내용수정',
      old_data: { title: existing.title },
      new_data: { title: updated.title },
    });

    return { success: true, data: updated };
  }

  // --------------------------------------------------------------------------
  // sendDocumentToClient
  // --------------------------------------------------------------------------
  /**
   * 문서를 고객에게 발송
   *
   * 비즈니스 규칙:
   * 1. 문서가 존재하는지 검증
   * 2. 아직 승인되지 않은 문서는 발송 불가 (핵심 규칙)
   * 3. 이미 발송된 문서는 재발송 불가
   * 4. 발송 시 상태를 'sent'로 변경
   * 5. 발송 시 activity_logs에 기록
   */
  async sendDocumentToClient(
    input: SendDocumentInput,
    ctx: DocumentServiceContext,
  ): Promise<ServiceResult<ProjectDocument>> {
    // [단계 1] 문서 존재 검증
    const document = await this.documentRepo.findById(input.document_id);
    if (!document) {
      return {
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: '문서를 찾을 수 없습니다' },
      };
    }

    // [단계 2] 승인 여부 검증 - 코어 비즈니스 규칙
    if (!canSendDocument(document.status)) {
      return {
        success: false,
        error: {
          code: 'DOCUMENT_NOT_APPROVED',
          message: `승인되지 않은 문서는 발송할 수 없습니다. 현재상태: ${DOCUMENT_STATUS_META[document.status].label}`,
        },
      };
    }

    // [단계 3] 이미 발송된 문서 검증
    if (document.is_sent) {
      return {
        success: false,
        error: { code: 'DOCUMENT_ALREADY_SENT', message: '이미 발송된 문서입니다' },
      };
    }

    // [단계 4] 발송 처리 및 상태 변경 + 발송 정보 기록
    const sent = await this.documentRepo.update(input.document_id, {
      status: 'sent',
      is_sent: true,
      sent_at: new Date().toISOString(),
      sent_by: ctx.userId,
      sent_to: input.sent_to,
    });

    // [단계 5] 발송 활동 로그 기록
    await this.activityLog.log({
      entity_type: 'document',
      entity_id: input.document_id,
      project_id: document.project_id,
      action: 'sent',
      actor_id: ctx.userId,
      description: `${DOCUMENT_TYPE_META[document.type].label} "${document.title}" 발송(수신: ${input.sent_to})`,
      old_data: { status: document.status },
      new_data: { status: 'sent', sent_to: input.sent_to },
    });

    return { success: true, data: sent };
  }

  // --------------------------------------------------------------------------
  // 내부 전용: 문서 상태 전환
  // --------------------------------------------------------------------------
  /**
   * 문서 상태 전환 (ApprovalService에서 호출)
   *
   * 비즈니스 규칙:
   * 1. 전환 가능한 상태인지 검증
   * 2. 상태 변경 활동 로그 기록
   */
  async transitionDocumentStatus(
    documentId: string,
    toStatus: DocumentStatus,
    ctx: DocumentServiceContext,
    reason?: string,
  ): Promise<ServiceResult<ProjectDocument>> {
    const document = await this.documentRepo.findById(documentId);
    if (!document) {
      return {
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: '문서를 찾을 수 없습니다' },
      };
    }

    // [단계 1] 상태 전환 가능 여부 검증
    if (!canTransitionDocumentStatus(document.status, toStatus)) {
      return {
        success: false,
        error: {
          code: 'INVALID_DOCUMENT_TRANSITION',
          message: `${DOCUMENT_STATUS_META[document.status].label}에서 ${DOCUMENT_STATUS_META[toStatus].label}(으)로 전환할 수 없습니다`,
        },
      };
    }

    const fromStatus = document.status;

    // rejected → draft 전환 시 버전 증가
    const versionBump = fromStatus === 'rejected' && toStatus === 'draft'
      ? { version: document.version + 1 }
      : {};

    const updated = await this.documentRepo.update(documentId, {
      status: toStatus,
      ...versionBump,
    });

    // [단계 2] 상태 변경 활동 로그 기록
    await this.activityLog.log({
      entity_type: 'document',
      entity_id: documentId,
      project_id: document.project_id,
      action: 'status_changed',
      actor_id: ctx.userId,
      description: `문서 상태 변경: ${DOCUMENT_STATUS_META[fromStatus].label} → ${DOCUMENT_STATUS_META[toStatus].label}`,
      old_data: { status: fromStatus },
      new_data: { status: toStatus },
      metadata: reason ? { reason } : undefined,
    });

    return { success: true, data: updated };
  }
}
