/**
 * Approval Service
 *
 * 문서 승인/반려/취소 비즈니스 로직을 담당합니다.
 *
 * 핵심 규칙:
 * - 승인 레코드는 INSERT only
 * - 문서의 모든 단계 승인이 완료되면 approved로 전환
 * - 각 단계별 역할 권한(권한 레벨) 검증
 * - 이전 단계 미완료 시 다음 단계 차단
 */

import type {
  DocumentApproval,
  ApprovalPolicyWithSteps,
  ServiceResult,
} from '../types';
import type {
  RequestApprovalInput,
  ProcessApprovalInput,
  CancelApprovalInput,
} from '../types';
import { DOCUMENT_STATUS_META, APPROVAL_ACTION_META, USER_ROLE_META, PROJECT_STATUS_GROUPS } from '../types';
import type { IApprovalRepository, IDocumentRepository, IApprovalPolicyRepository, IProjectRepository } from '../repositories/interfaces';
import type { DocumentService } from './document.service';
import type { ActivityLogService } from './activity-log.service';

interface ApprovalServiceContext {
  userId: string;
  userRole: 'admin' | 'manager' | 'member';
  organizationId: string;
}

const ROLE_LEVELS: Record<string, number> = {
  admin: 100,
  manager: 50,
  member: 10,
};

export class ApprovalService {
  constructor(
    private readonly approvalRepo: IApprovalRepository,
    private readonly documentRepo: IDocumentRepository,
    private readonly policyRepo: IApprovalPolicyRepository,
    private readonly documentService: DocumentService,
    private readonly activityLog: ActivityLogService,
    private readonly projectRepo: IProjectRepository,
  ) {}

  // --------------------------------------------------------------------------
  // getPolicy (내부 헬퍼)
  // --------------------------------------------------------------------------
  /**
   * 문서 타입에 맞는 승인 정책 조회
   *
   * 우선순위:
   * 1. 문서 타입 전용 정책 (document_type = 'estimate')
   * 2. 조직 기본 정책 (document_type = null)
   * 3. 없으면 기본값 1단계 manager
   */
  private async getPolicy(
    organizationId: string,
    documentType: string,
  ): Promise<ApprovalPolicyWithSteps> {
    // 타입 전용 정책 우선
    const specific = await this.policyRepo.findByOrgAndType(organizationId, documentType);
    if (specific) {
      // 방어적 검증: 조회된 정책의 조직이 요청 조직과 일치하는지 확인
      if (specific.organization_id !== organizationId) {
        throw new Error(
          `approval policy organization mismatch: expected ${organizationId}, got ${specific.organization_id}`,
        );
      }
      return specific;
    }

    // 조직 기본 정책
    const fallback = await this.policyRepo.findByOrgAndType(organizationId, null);
    if (fallback) {
      if (fallback.organization_id !== organizationId) {
        throw new Error(
          `approval policy organization mismatch: expected ${organizationId}, got ${fallback.organization_id}`,
        );
      }
      return fallback;
    }

    // 하드코딩 기본값 (DB에 정책이 없는 경우)
    return {
      id: 'default',
      organization_id: organizationId,
      document_type: null,
      required_steps: 1,
      description: '기본 승인 정책',
      is_active: true,
      created_at: '',
      updated_at: '',
      steps: [{ id: 'default-step', policy_id: 'default', step: 1, required_role: 'manager', label: '매니저 승인', assigned_user_id: null, created_at: '' }],
    };
  }

  // --------------------------------------------------------------------------
  // verifyDocumentOrgScope (내부 헬퍼)
  // --------------------------------------------------------------------------
  /**
   * 문서가 속한 프로젝트의 조직이 요청 컨텍스트의 조직과 일치하는지 검증.
   *
   * RLS 외 애플리케이션 계층의 2차 방어선.
   * 견적서/계약서/진행안 등 모든 문서 승인 처리 시 반드시 호출해야 한다.
   *
   * @returns 일치하면 null, 불일치/누락이면 실패 ServiceResult
   */
  private async verifyDocumentOrgScope(
    documentProjectId: string,
    ctx: ApprovalServiceContext,
  ): Promise<{ code: string; message: string } | null> {
    const project = await this.projectRepo.findById(documentProjectId);
    if (!project) {
      return { code: 'PROJECT_NOT_FOUND', message: '문서의 프로젝트를 찾을 수 없습니다' };
    }
    if (project.organization_id !== ctx.organizationId) {
      return {
        code: 'ORGANIZATION_MISMATCH',
        message: '다른 조직의 문서에 대한 승인 처리는 허용되지 않습니다',
      };
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // requestDocumentApproval
  // --------------------------------------------------------------------------
  /**
   * 문서 승인 요청 (1단계부터 시작)
   *
   * 비즈니스 규칙:
   * 1. 문서가 존재하는지 검증
   * 2. draft 또는 rejected 상태에서만 승인 요청 가능
   * 3. 이미 대기 중인 승인 요청이 없는지 검증
   * 4. 문서 상태를 in_review로 전환
   * 5. 1단계 승인 요청 레코드 생성
   * 6. 활동 로그 기록
   */
  async requestDocumentApproval(
    input: RequestApprovalInput,
    ctx: ApprovalServiceContext,
  ): Promise<ServiceResult<DocumentApproval>> {
    // [단계 1] 문서 존재 검증
    const document = await this.documentRepo.findById(input.document_id);
    if (!document) {
      return {
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: '문서를 찾을 수 없습니다' },
      };
    }

    // [단계 1-1] 조직 일치성 검증 (RLS 외 애플리케이션 방어선)
    const orgError = await this.verifyDocumentOrgScope(document.project_id, ctx);
    if (orgError) {
      return { success: false, error: orgError };
    }

    // [단계 2] draft 또는 rejected 상태에서만 승인 요청 가능
    if (document.status !== 'draft' && document.status !== 'rejected') {
      return {
        success: false,
        error: {
          code: 'INVALID_DOCUMENT_STATUS',
          message: `${DOCUMENT_STATUS_META[document.status].label} 상태에서는 승인을 요청할 수 없습니다`,
        },
      };
    }

    // [단계 3] 이미 대기 중인 승인 요청이 없는지 확인
    const pendingApproval = await this.approvalRepo.findPendingByDocumentId(input.document_id);
    if (pendingApproval) {
      return {
        success: false,
        error: { code: 'APPROVAL_ALREADY_PENDING', message: '이미 대기 중인 승인 요청이 있습니다' },
      };
    }

    // 정책 조회 (승인 단계 수 확인)
    const policy = await this.getPolicy(ctx.organizationId, document.type);

    // [단계 4] 문서 상태를 in_review로 전환
    const transitionResult = await this.documentService.transitionDocumentStatus(
      input.document_id,
      'in_review',
      ctx,
    );
    if (!transitionResult.success) {
      return { success: false, error: transitionResult.error! };
    }

    // [단계 5] 1단계 승인 요청 레코드 생성
    const stepConfig = policy.steps.find(s => s.step === 1);
    const approval = await this.approvalRepo.create({
      document_id: input.document_id,
      requested_by: ctx.userId,
      step: 1,
      comment: input.comment ?? null,
      metadata: {
        required_steps: policy.required_steps,
        step_label: stepConfig?.label ?? null,
        step_role: stepConfig?.required_role ?? 'manager',
      },
    });

    // [단계 6] 활동 로그 기록
    await this.activityLog.log({
      entity_type: 'approval',
      entity_id: approval.id,
      project_id: document.project_id,
      action: 'approval_requested',
      actor_id: ctx.userId,
      description: `문서 "${document.title}" 승인 요청 (1/${policy.required_steps}단계)`,
      new_data: { document_id: input.document_id, step: 1, required_steps: policy.required_steps },
    });

    return { success: true, data: approval };
  }

  // --------------------------------------------------------------------------
  // approveDocument
  // --------------------------------------------------------------------------
  /**
   * 문서 승인 (현재 단계)
   *
   * 비즈니스 규칙:
   * 1. 승인 요청 존재 + 미처리 여부 검증
   * 2. 현재 단계의 역할 권한(권한 레벨) 검증
   * 3. 자기 승인 차단
   * 4. 승인 레코드 기록
   * 5. 모든 단계 완료 시 문서 approved 전환
   *    아직 남은 단계 시 다음 단계 승인 요청 자동 생성
   * 6. 활동 로그 기록
   */
  async approveDocument(
    input: ProcessApprovalInput,
    ctx: ApprovalServiceContext,
  ): Promise<ServiceResult<DocumentApproval>> {
    // [단계 1] 승인 요청 존재 + 미처리 여부 검증
    const approval = await this.approvalRepo.findById(input.approval_id);
    if (!approval) {
      return {
        success: false,
        error: { code: 'APPROVAL_NOT_FOUND', message: '승인 요청을 찾을 수 없습니다' },
      };
    }

    if (approval.action !== null) {
      return {
        success: false,
        error: {
          code: 'APPROVAL_ALREADY_PROCESSED',
          message: `이미 ${APPROVAL_ACTION_META[approval.action].label} 처리된 요청입니다`,
        },
      };
    }

    // [단계 2] 단계별 권한 검증
    const document = await this.documentRepo.findById(approval.document_id);
    if (!document) {
      return {
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: '문서를 찾을 수 없습니다' },
      };
    }

    // 조직 일치성 검증
    const orgError = await this.verifyDocumentOrgScope(document.project_id, ctx);
    if (orgError) {
      return { success: false, error: orgError };
    }

    const policy = await this.getPolicy(ctx.organizationId, document.type);
    const stepConfig = policy.steps.find(s => s.step === approval.step);
    const requiredRole = stepConfig?.required_role ?? 'manager';

    if (ROLE_LEVELS[ctx.userRole] < ROLE_LEVELS[requiredRole]) {
      return {
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSION',
          message: `이 단계는 ${USER_ROLE_META[requiredRole as keyof typeof USER_ROLE_META].label} 이상만 승인할 수 있습니다`,
        },
      };
    }

    // 승인 담당자가 지정된 단계이면 해당 담당자만 승인 가능
    if (stepConfig?.assigned_user_id && stepConfig.assigned_user_id !== ctx.userId) {
      return {
        success: false,
        error: { code: 'NOT_ASSIGNED_APPROVER', message: '이 단계의 지정 승인자가 아닙니다' },
      };
    }

    // [단계 4] 현재 단계 승인 기록
    const updated = await this.approvalRepo.update(input.approval_id, {
      approver_id: ctx.userId,
      action: 'approve',
      actioned_at: new Date().toISOString(),
      comment: input.comment ?? null,
    });

    const currentStep = approval.step;
    const requiredSteps = policy.required_steps;
    const isLastStep = currentStep >= requiredSteps;

    if (isLastStep) {
      // [단계 5a] 모든 단계 완료 시 approved 전환
      await this.documentService.transitionDocumentStatus(
        approval.document_id,
        'approved',
        ctx,
      );
    } else {
      // [단계 5b] 다음 단계 승인 요청 자동 생성
      const nextStep = currentStep + 1;
      const nextStepConfig = policy.steps.find(s => s.step === nextStep);

      await this.approvalRepo.create({
        document_id: approval.document_id,
        requested_by: ctx.userId, // 이전 단계 승인자가 다음 단계 요청자
        step: nextStep,
        comment: null,
        metadata: {
          required_steps: requiredSteps,
          step_label: nextStepConfig?.label ?? null,
          step_role: nextStepConfig?.required_role ?? 'admin',
        },
      });
    }

    // [단계 6] 활동 로그 기록
    const stepLabel = stepConfig?.label ?? `${currentStep}단계`;
    await this.activityLog.log({
      entity_type: 'approval',
      entity_id: input.approval_id,
      project_id: document.project_id,
      action: 'approved',
      actor_id: ctx.userId,
      description: isLastStep
        ? `문서 "${document.title}" 최종 승인 완료 (${currentStep}/${requiredSteps}단계)`
        : `문서 "${document.title}" ${stepLabel} 승인 (${currentStep}/${requiredSteps}단계)`,
      new_data: { action: 'approve', step: currentStep, required_steps: requiredSteps },
      metadata: input.comment ? { comment: input.comment } : undefined,
    });

    return { success: true, data: updated };
  }

  // --------------------------------------------------------------------------
  // rejectDocument
  // --------------------------------------------------------------------------
  /**
   * 문서 반려 (어느 단계에서든 즉시 반려)
   *
   * 비즈니스 규칙:
   * 1. 승인 요청 존재 + 미처리 여부 검증
   * 2. 단계별 권한 검증
   * 3. 반려 사유(comment) 필수
   * 4. 반려 레코드 기록
   * 5. 문서 상태를 rejected로 전환
   * 6. 활동 로그 기록
   */
  async rejectDocument(
    input: ProcessApprovalInput,
    ctx: ApprovalServiceContext,
  ): Promise<ServiceResult<DocumentApproval>> {
    const approval = await this.approvalRepo.findById(input.approval_id);
    if (!approval) {
      return {
        success: false,
        error: { code: 'APPROVAL_NOT_FOUND', message: '승인 요청을 찾을 수 없습니다' },
      };
    }

    if (approval.action !== null) {
      return {
        success: false,
        error: {
          code: 'APPROVAL_ALREADY_PROCESSED',
          message: `이미 ${APPROVAL_ACTION_META[approval.action].label} 처리된 요청입니다`,
        },
      };
    }

    // 단계별 권한 검증
    const document = await this.documentRepo.findById(approval.document_id);
    if (!document) {
      return {
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: '문서를 찾을 수 없습니다' },
      };
    }

    // 조직 일치성 검증
    const orgError = await this.verifyDocumentOrgScope(document.project_id, ctx);
    if (orgError) {
      return { success: false, error: orgError };
    }

    const policy = await this.getPolicy(ctx.organizationId, document.type);
    const stepConfig = policy.steps.find(s => s.step === approval.step);
    const requiredRole = stepConfig?.required_role ?? 'manager';

    if (ROLE_LEVELS[ctx.userRole] < ROLE_LEVELS[requiredRole]) {
      return {
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSION',
          message: `이 단계는 ${USER_ROLE_META[requiredRole as keyof typeof USER_ROLE_META].label} 이상만 반려할 수 있습니다`,
        },
      };
    }

    // 반려 사유 필수
    if (!input.comment?.trim()) {
      return {
        success: false,
        error: { code: 'REJECTION_REASON_REQUIRED', message: '반려 시 사유를 반드시 입력해야합니다' },
      };
    }

    // 반려 레코드
    const updated = await this.approvalRepo.update(input.approval_id, {
      approver_id: ctx.userId,
      action: 'reject',
      actioned_at: new Date().toISOString(),
      comment: input.comment,
    });

    // 문서 상태 rejected 전환
    await this.documentService.transitionDocumentStatus(
      approval.document_id,
      'rejected',
      ctx,
      input.comment,
    );

    // 활동 로그 기록
    const stepLabel = stepConfig?.label ?? `${approval.step}단계`;
    await this.activityLog.log({
      entity_type: 'approval',
      entity_id: input.approval_id,
      project_id: document.project_id,
      action: 'rejected',
      actor_id: ctx.userId,
      description: `문서 "${document.title}" ${stepLabel}에서 반려: ${input.comment}`,
      new_data: { action: 'reject', step: approval.step },
      metadata: { comment: input.comment },
    });

    return { success: true, data: updated };
  }

  // --------------------------------------------------------------------------
  // cancelApprovalRequest
  // --------------------------------------------------------------------------
  /**
   * 승인 요청 취소
   *
   * 비즈니스 규칙:
   * 1. 승인 요청 존재 + 미처리 여부 검증
   * 2. 요청자 본인이거나 admin만 취소 가능
   * 3. 취소 레코드 기록
   * 4. 문서 상태를 다시 draft로 전환
   * 5. 활동 로그 기록
   */
  async cancelApprovalRequest(
    input: CancelApprovalInput,
    ctx: ApprovalServiceContext,
  ): Promise<ServiceResult<DocumentApproval>> {
    const approval = await this.approvalRepo.findById(input.approval_id);
    if (!approval) {
      return {
        success: false,
        error: { code: 'APPROVAL_NOT_FOUND', message: '승인 요청을 찾을 수 없습니다' },
      };
    }

    if (approval.action !== null) {
      return {
        success: false,
        error: { code: 'APPROVAL_ALREADY_PROCESSED', message: '이미 처리된 승인 요청은 취소할 수 없습니다' },
      };
    }

    // 취소 권한: 최초 승인 요청자(1단계) 또는 admin
    // 다단계 추가 단계에서는 admin이면 취소 가능
    if (approval.requested_by !== ctx.userId && ctx.userRole !== 'admin') {
      return {
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSION', message: '본인이 요청한 승인만 취소할 수 있습니다' },
      };
    }

    // 조직 일치성 검증 (업데이트 전 확인)
    const docForOrgCheck = await this.documentRepo.findById(approval.document_id);
    if (!docForOrgCheck) {
      return {
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: '문서를 찾을 수 없습니다' },
      };
    }
    const orgError = await this.verifyDocumentOrgScope(docForOrgCheck.project_id, ctx);
    if (orgError) {
      return { success: false, error: orgError };
    }

    const updated = await this.approvalRepo.update(input.approval_id, {
      approver_id: ctx.userId,
      action: 'cancel',
      actioned_at: new Date().toISOString(),
      comment: input.comment ?? null,
    });

    // 문서 상태를 draft로 복원
    const document = await this.documentRepo.findById(approval.document_id);
    if (document && document.status === 'in_review') {
      await this.documentRepo.update(approval.document_id, { status: 'draft' });
    }

    // 활동 로그 기록
    await this.activityLog.log({
      entity_type: 'approval',
      entity_id: input.approval_id,
      project_id: document?.project_id,
      action: 'approval_cancelled',
      actor_id: ctx.userId,
      description: `문서 "${document?.title ?? ''}" 승인 요청 취소`,
      new_data: { action: 'cancel', step: approval.step },
      metadata: input.comment ? { comment: input.comment } : undefined,
    });

    return { success: true, data: updated };
  }

  // --------------------------------------------------------------------------
  // revertApproval
  // --------------------------------------------------------------------------
  /**
   * 승인/반려 번복 (이미 처리된 승인 레코드를 대기 상태로 되돌림)
   *
   * 비즈니스 규칙:
   * 1. 승인 요청 존재 + approve/reject 처리 여부 검증
   * 2. manager 이상 역할 필요
   * 3. 프로젝트가 다음 플로우로 넘어갔으면 번복 불가
   * 4. 해당 단계 이후 자동 생성된 승인 레코드 삭제
   * 5. 승인 레코드를 대기(action=null)로 리셋
   * 6. 문서가 approved/rejected이면 in_review로 복원
   * 7. 프로젝트 상태를 해당 플로우의 review 상태로 복원
   * 8. 활동 로그 기록
   */
  async revertApproval(
    input: ProcessApprovalInput,
    ctx: ApprovalServiceContext,
  ): Promise<ServiceResult<DocumentApproval>> {
    const approval = await this.approvalRepo.findById(input.approval_id);
    if (!approval) {
      return {
        success: false,
        error: { code: 'APPROVAL_NOT_FOUND', message: '승인 요청을 찾을 수 없습니다' },
      };
    }

    if (approval.action !== 'approve' && approval.action !== 'reject') {
      return {
        success: false,
        error: { code: 'NOT_PROCESSED', message: '승인 또는 반려된 요청만 번복할 수 있습니다' },
      };
    }

    // 권한 검증: manager 이상
    if (ROLE_LEVELS[ctx.userRole] < ROLE_LEVELS['manager']) {
      return {
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSION', message: '매니저 이상만 승인을 번복할 수 있습니다' },
      };
    }

    // 본인 확인: 승인/반려 당사자 또는 admin만 번복 가능
    if (approval.approver_id !== ctx.userId && ctx.userRole !== 'admin') {
      return {
        success: false,
        error: { code: 'NOT_ORIGINAL_APPROVER', message: '본인이 처리한 승인/반려만 번복할 수 있습니다' },
      };
    }

    const document = await this.documentRepo.findById(approval.document_id);
    if (!document) {
      return {
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: '문서를 찾을 수 없습니다' },
      };
    }

    // 조직 일치성 검증
    const orgError = await this.verifyDocumentOrgScope(document.project_id, ctx);
    if (orgError) {
      return { success: false, error: orgError };
    }

    // ── 프로젝트 플로우 그룹 검증 ──
    // 문서 타입 → 플로우 그룹 매핑
    const DOC_TYPE_FLOW_MAP: Record<string, { groupKey: string; reviewStatus: string }> = {
      estimate:   { groupKey: 'B', reviewStatus: 'B2_estimate_review' },
      contract:   { groupKey: 'C', reviewStatus: 'C2_contract_review' },
      pre_report: { groupKey: 'E', reviewStatus: 'E2_prereport_review' },
    };

    const flowConfig = DOC_TYPE_FLOW_MAP[document.type];
    let project = flowConfig ? await this.projectRepo.findById(document.project_id) : null;

    if (flowConfig && project) {
      // 프로젝트의 현재 상태가 속한 그룹 확인
      const currentGroup = PROJECT_STATUS_GROUPS.find((g) =>
        g.statuses.includes(project!.status as any),
      );

      if (currentGroup && currentGroup.key !== flowConfig.groupKey) {
        const groupLabel = PROJECT_STATUS_GROUPS.find((g) => g.key === flowConfig.groupKey)?.label ?? '';
        return {
          success: false,
          error: {
            code: 'FLOW_ALREADY_ADVANCED',
            message: `프로젝트가 이미 다음 단계로 진행되어 ${groupLabel} 승인을 번복할 수 없습니다`,
          },
        };
      }
    }

    const previousAction = approval.action;

    // 해당 단계 이후에 자동 생성된 승인 레코드 삭제 (다단계일 때)
    const allApprovals = await this.approvalRepo.findByDocumentId(approval.document_id);
    for (const a of allApprovals) {
      if (a.step > approval.step && a.id !== approval.id) {
        // 이후 단계의 미처리 레코드를 완전 삭제 (cancel 처리하면 라운드 감지에 영향)
        if (a.action === null) {
          await this.approvalRepo.delete(a.id);
        }
      }
    }

    // 승인 레코드를 대기 상태로 리셋
    const updated = await this.approvalRepo.update(input.approval_id, {
      approver_id: null,
      action: null,
      actioned_at: null,
      comment: input.comment ?? null,
    });

    // 문서 상태 복원: approved/rejected → in_review
    if (document.status === 'approved' || document.status === 'rejected') {
      await this.documentRepo.update(approval.document_id, { status: 'in_review' });
    }

    // 프로젝트 상태를 해당 플로우의 review 상태로 복원
    if (flowConfig && project) {
      const currentGroup = PROJECT_STATUS_GROUPS.find((g) =>
        g.statuses.includes(project!.status as any),
      );

      // 같은 그룹 내에 있고 review 상태가 아닌 경우 review 상태로 되돌림
      if (currentGroup?.key === flowConfig.groupKey && project.status !== flowConfig.reviewStatus) {
        await this.projectRepo.update(document.project_id, {
          status: flowConfig.reviewStatus as any,
        });
      }
    }

    // 활동 로그 기록
    await this.activityLog.log({
      entity_type: 'approval',
      entity_id: input.approval_id,
      project_id: document.project_id,
      action: 'approval_reverted',
      actor_id: ctx.userId,
      description: `문서 "${document.title}" ${approval.step}단계 ${previousAction === 'approve' ? '승인' : '반려'} 번복`,
      new_data: { action: 'revert', step: approval.step, previous_action: previousAction },
      metadata: input.comment ? { comment: input.comment } : undefined,
    });

    return { success: true, data: updated };
  }

  // --------------------------------------------------------------------------
  // getApprovalHistory
  // --------------------------------------------------------------------------
  async getApprovalHistory(documentId: string): Promise<DocumentApproval[]> {
    return this.approvalRepo.findByDocumentId(documentId);
  }

  // --------------------------------------------------------------------------
  // getApprovalProgress
  // --------------------------------------------------------------------------
  /**
   * 문서의 현재 승인 진행 상태 조회
   *
   * @returns { requiredSteps, completedSteps, currentStep, isFullyApproved, steps }
   */
  async getApprovalProgress(
    documentId: string,
    organizationId: string,
  ): Promise<{
    requiredSteps: number;
    completedSteps: number;
    currentStep: number | null;
    isFullyApproved: boolean;
    steps: { step: number; label: string | null; status: 'approved' | 'pending' | 'waiting'; assigned_user_id: string | null }[];
  }> {
    const document = await this.documentRepo.findById(documentId);
    if (!document) {
      return { requiredSteps: 1, completedSteps: 0, currentStep: null, isFullyApproved: false, steps: [] };
    }

    const policy = await this.getPolicy(organizationId, document.type);
    const approvals = await this.approvalRepo.findByDocumentId(documentId);

    // 현재 라운드의 승인만 추적 (rejected시 재요청 후 이전 라운드 무시)
    // 마지막 reject/cancel 이후의 승인만 카운트
    let roundStart = 0;
    for (let i = approvals.length - 1; i >= 0; i--) {
      if (approvals[i].action === 'reject' || approvals[i].action === 'cancel') {
        roundStart = i + 1;
        break;
      }
    }
    const currentRoundApprovals = approvals.slice(roundStart);

    const completedSteps = currentRoundApprovals.filter(a => a.action === 'approve').length;
    const isFullyApproved = completedSteps >= policy.required_steps;

    // 단계별 상태 빌드 (순차적: 이전 단계 미승인 시 이후는 waiting)
    const steps = [];
    let allPreviousApproved = true;
    for (let s = 1; s <= policy.required_steps; s++) {
      const stepConfig = policy.steps.find(ps => ps.step === s);
      const approval = currentRoundApprovals.find(a => a.step === s);
      let status: 'approved' | 'pending' | 'waiting';
      if (approval?.action === 'approve') {
        status = 'approved';
      } else if (allPreviousApproved) {
        status = 'pending';
        allPreviousApproved = false;
      } else {
        status = 'waiting';
      }
      steps.push({ step: s, label: stepConfig?.label ?? null, status, assigned_user_id: stepConfig?.assigned_user_id ?? null });
    }

    const currentStep = steps.find(st => st.status === 'pending')?.step ?? null;

    return { requiredSteps: policy.required_steps, completedSteps, currentStep, isFullyApproved, steps };
  }
}
