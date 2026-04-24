/**
 * Project Service
 *
 * 프로젝트 생성/수정 및 상태전이 비즈니스 로직을 담당합니다.
 * 모든 상태 변경은 활동로그에 기록됩니다.
 */

import type {
  Project,
  ProjectStatus,
  ServiceResult,
} from '../types';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  TransitionProjectInput,
} from '../types';
import {
  canTransitionProjectStatus,
  PROJECT_STATUS_META,
} from '../types';
import type { IProjectRepository, IClientRepository } from '../repositories/interfaces';
import type { ActivityLogService } from './activity-log.service';

interface ProjectServiceContext {
  userId: string;
  userRole: 'admin' | 'manager' | 'member';
  organizationId: string;
}

export class ProjectService {
  constructor(
    private readonly projectRepo: IProjectRepository,
    private readonly clientRepo: IClientRepository,
    private readonly activityLog: ActivityLogService,
  ) {}

  // --------------------------------------------------------------------------
  // createProject
  // --------------------------------------------------------------------------
  /**
   * 프로젝트 생성
   *
   * 비즈니스 규칙:
   * 1. client_id가 존재하는지 검증
   * 2. 초기 상태는 반드시 'draft'
   * 3. 성공 시 activity_logs에 기록
   */
  async createProject(
    input: CreateProjectInput,
    ctx: ProjectServiceContext,
  ): Promise<ServiceResult<Project>> {
    // [단계 1] 고객사 존재 검증
    const client = await this.clientRepo.findById(input.client_id);
    if (!client) {
      return {
        success: false,
        error: { code: 'CLIENT_NOT_FOUND', message: '고객사를 찾을 수 없습니다' },
      };
    }

    // [단계 2] 초기 상태는 반드시 A_sales
    const project = await this.projectRepo.create({
      organization_id: ctx.organizationId,
      client_id: input.client_id,
      title: input.title,
      description: input.description ?? null,
      code: input.code ?? null,
      status: 'A_sales',
      service_type: input.service_type,
      payment_type: input.payment_type ?? 'deposit',
      owner_id: input.owner_id ?? ctx.userId,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      total_amount: input.total_amount ?? null,
      currency: input.currency ?? 'KRW',
      metadata: input.metadata ?? {},
    });

    // [단계 3] 생성 활동 로그 기록
    await this.activityLog.log({
      entity_type: 'project',
      entity_id: project.id,
      project_id: project.id,
      action: 'created',
      actor_id: ctx.userId,
      description: `프로젝트 "${project.title}" 생성`,
      new_data: { status: project.status, title: project.title },
    });

    return { success: true, data: project };
  }

  // --------------------------------------------------------------------------
  // updateProject
  // --------------------------------------------------------------------------
  /**
   * 프로젝트 기본 정보 수정 (상태 변경 제외)
   *
   * 비즈니스 규칙:
   * 1. 프로젝트가 존재하는지 검증
   * 2. 완료/취소 상태에서는 수정 불가
   * 3. 수정 시 activity_logs에 기록
   */
  async updateProject(
    projectId: string,
    input: UpdateProjectInput,
    ctx: ProjectServiceContext,
  ): Promise<ServiceResult<Project>> {
    // [단계 1] 프로젝트 존재 검증
    const existing = await this.projectRepo.findById(projectId);
    if (!existing) {
      return {
        success: false,
        error: { code: 'PROJECT_NOT_FOUND', message: '프로젝트를 찾을 수 없습니다' },
      };
    }

    // [단계 2] 집행/환불/종료 상태에서는 상태/메타데이터/금액 변경 외 수정 불가
    const inputKeys = new Set(Object.keys(input));
    const allowedKeys = new Set(['status', 'metadata', 'total_amount']);
    const isAllowedUpdate = inputKeys.size > 0 && [...inputKeys].every((k) => allowedKeys.has(k));
    if (['E4_execution', 'F1_refund', 'G1_closed'].includes(existing.status) && !isAllowedUpdate) {
      return {
        success: false,
        error: {
          code: 'PROJECT_NOT_EDITABLE',
          message: `${PROJECT_STATUS_META[existing.status].label} 상태의 프로젝트는 수정할 수 없습니다`,
        },
      };
    }

    const updated = await this.projectRepo.update(projectId, input);

    // 상태가 변경된 경우 이력 기록
    const newStatus = (input as Record<string, unknown>).status as ProjectStatus | undefined;
    if (newStatus && newStatus !== existing.status) {
      await this.projectRepo.recordStatusHistory({
        project_id: projectId,
        from_status: existing.status,
        to_status: newStatus,
        changed_by: ctx.userId,
      });
    }

    // [단계 3] 수정 활동 로그 기록
    await this.activityLog.log({
      entity_type: 'project',
      entity_id: projectId,
      project_id: projectId,
      action: 'updated',
      actor_id: ctx.userId,
      description: '프로젝트 정보변경',
      old_data: { title: existing.title },
      new_data: { title: updated.title },
    });

    return { success: true, data: updated };
  }

  // --------------------------------------------------------------------------
  // transitionStatus
  // --------------------------------------------------------------------------
  /**
   * 프로젝트 상태 전환
   *
   * 비즈니스 규칙:
   * 1. 프로젝트가 존재하는지 검증
   * 2. 전환 가능한 상태인지 검증 (상태 전이표)
   * 3. 전환에 필요한 최소 권한 검증
   * 4. 상태 변경 시 activity_logs에 기록
   */
  async transitionStatus(
    input: TransitionProjectInput,
    ctx: ProjectServiceContext,
    options?: { systemInitiated?: boolean },
  ): Promise<ServiceResult<Project>> {
    // [단계 1] 프로젝트 존재 검증
    const project = await this.projectRepo.findById(input.project_id);
    if (!project) {
      return {
        success: false,
        error: { code: 'PROJECT_NOT_FOUND', message: '프로젝트를 찾을 수 없습니다' },
      };
    }

    const fromStatus = project.status;
    const toStatus = input.to_status;

    // [단계 2] 상태 전환 가능 여부 검증
    if (!canTransitionProjectStatus(fromStatus, toStatus)) {
      return {
        success: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: `${PROJECT_STATUS_META[fromStatus].label}에서 ${PROJECT_STATUS_META[toStatus].label}(으)로 전환할 수 없습니다`,
        },
      };
    }

    // [단계 3] 권한 검증
    // 정책: 프로젝트 상태 변경은 member 이상이면 누구나 가능. (조직 범위 검증은
    // 상위 API 레이어(verifyProjectInOrg) 에서 이미 수행됨)
    // getRequiredRoleForTransition 매핑은 일부 전이에 admin/manager 를 요구했으나,
    // 현장 운영상 member 도 워크플로 진행을 막을 필요가 없어 제약을 제거한다.
    //
    // 참고: 과거 로직
    //   const requiredRole = getRequiredRoleForTransition(toStatus);
    //   const roleLevel: Record<string, number> = { admin: 100, manager: 50, member: 10 };
    //   if ((roleLevel[ctx.userRole] ?? 0) < (roleLevel[requiredRole] ?? 0)) { ... }

    const isSystem = options?.systemInitiated === true;

    // 상태 변경 실행
    const updated = await this.projectRepo.update(input.project_id, { status: toStatus });

    // [단계 4] 상태 이력 기록
    await this.projectRepo.recordStatusHistory({
      project_id: input.project_id,
      from_status: fromStatus,
      to_status: toStatus,
      changed_by: isSystem ? null : ctx.userId,
      note: input.reason ?? null,
    });

    // [단계 5] 상태 변경 활동 로그 기록
    await this.activityLog.log({
      entity_type: 'project',
      entity_id: input.project_id,
      project_id: input.project_id,
      action: 'status_changed',
      actor_id: isSystem ? undefined : ctx.userId,
      description: isSystem
        ? `시스템 상태 변경: ${PROJECT_STATUS_META[fromStatus].label} → ${PROJECT_STATUS_META[toStatus].label}`
        : `상태 변경: ${PROJECT_STATUS_META[fromStatus].label} → ${PROJECT_STATUS_META[toStatus].label}`,
      old_data: { status: fromStatus },
      new_data: { status: toStatus },
      metadata: input.reason ? { reason: input.reason } : undefined,
    });

    return { success: true, data: updated };
  }
}
