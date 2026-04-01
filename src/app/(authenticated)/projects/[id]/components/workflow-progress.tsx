'use client';

/**
 * WorkflowProgress - 서비스 유형별 고객 대응 플로우 시각화
 *
 * 이미지 플로우차트를 반영:
 * - 바이럴: 영업 → 견적서(단일결제) → [승인] → 입금확인 → 바이럴 집행
 * - 퍼포먼스: 영업 → 견적서(월계약) → [승인] → 계약체결 → 입금확인 → 사전보고서 → 광고집행
 * - 바이럴+퍼포먼스: 위 퍼포먼스와 동일 경로
 */

import type { ProjectStatus, ServiceType } from '@/lib/domain/types';
import { SERVICE_TYPE_META } from '@/lib/domain/types';
import styles from './workflow-progress.module.css';

interface WorkflowStep {
  key: string;
  label: string;
  description: string;
  /** 이 스텝에 해당하는 프로젝트 상태들 */
  matchStatuses: ProjectStatus[];
}

/** 바이럴 전용 플로우 */
const VIRAL_STEPS: WorkflowStep[] = [
  { key: 'sales',    label: '영업',           description: '고객 미팅 및 요구사항 파악', matchStatuses: ['draft'] },
  { key: 'estimate', label: '단일 결제 견적서', description: '견적서 작성 및 승인/발송',   matchStatuses: ['quoted'] },
  { key: 'payment',  label: '입금 확인',       description: '입금 확인 후 작업 시작',     matchStatuses: ['paid'] },
  { key: 'execute',  label: '바이럴 집행',     description: '바이럴 마케팅 집행',         matchStatuses: ['running', 'paused'] },
  { key: 'done',     label: '완료',           description: '프로젝트 완료',              matchStatuses: ['completed'] },
];

/** 퍼포먼스 / 바이럴+퍼포먼스 플로우 */
const CONTRACT_STEPS: WorkflowStep[] = [
  { key: 'sales',      label: '영업',           description: '고객 미팅 및 요구사항 파악',  matchStatuses: ['draft'] },
  { key: 'estimate',   label: '월 계약 견적서',  description: '견적서 작성 및 승인/발송',    matchStatuses: ['quoted'] },
  { key: 'contract',   label: '계약 체결',       description: '계약서 작성 및 서명',         matchStatuses: ['contracted'] },
  { key: 'payment',    label: '입금 확인',       description: '입금 확인',                  matchStatuses: ['paid'] },
  { key: 'pre_report', label: '집행 사전 보고서', description: '집행 전 사전 보고서 작성/승인', matchStatuses: ['running', 'paused'] },
  { key: 'execute',    label: '광고 및 바이럴 집행', description: '광고 + 바이럴 마케팅 집행', matchStatuses: ['running', 'paused'] },
  { key: 'done',       label: '완료',           description: '프로젝트 완료 또는 계약 유지', matchStatuses: ['completed'] },
];

function getSteps(serviceType: ServiceType): WorkflowStep[] {
  return serviceType === 'viral' ? VIRAL_STEPS : CONTRACT_STEPS;
}

/** 현재 상태에서 활성 스텝 인덱스 결정 */
function getActiveIndex(steps: WorkflowStep[], status: ProjectStatus): number {
  // rejected → estimate 단계에서 반려된 것
  if (status === 'rejected') return 1;
  // cancelled/refunded → 마지막 활성이었던 단계를 모름, -1 처리
  if (status === 'cancelled' || status === 'refunded') return -1;

  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].matchStatuses.includes(status)) return i;
  }
  return 0;
}

type StepState = 'done' | 'active' | 'upcoming' | 'rejected';

function getStepState(stepIndex: number, activeIndex: number, status: ProjectStatus): StepState {
  if (status === 'rejected' && stepIndex === 1) return 'rejected';
  if (activeIndex < 0) return 'upcoming'; // cancelled
  if (stepIndex < activeIndex) return 'done';
  if (stepIndex === activeIndex) return 'active';
  return 'upcoming';
}

interface WorkflowProgressProps {
  serviceType: ServiceType;
  projectStatus: ProjectStatus;
}

export function WorkflowProgress({ serviceType, projectStatus }: WorkflowProgressProps) {
  const steps = getSteps(serviceType);
  const activeIndex = getActiveIndex(steps, projectStatus);
  const isCancelled = projectStatus === 'cancelled' || projectStatus === 'refunded';

  return (
    <section className="card">
      <div className={styles.header}>
        <h2 className="section-title">워크플로우 진행</h2>
        <span className={styles.serviceLabel}>
          {SERVICE_TYPE_META[serviceType].label} 플로우
        </span>
      </div>

      {isCancelled && (
        <div className={styles.cancelledBanner}>
          이 프로젝트는 {projectStatus === 'cancelled' ? '취소' : '환불 처리'}되었습니다
        </div>
      )}

      {/* 스텝 타임라인 */}
      <div className={styles.timeline}>
        {steps.map((step, i) => {
          const state = getStepState(i, activeIndex, projectStatus);
          return (
            <div key={step.key} className={`${styles.step} ${styles[state]}`}>
              {/* 커넥터 라인 (첫 번째 제외) */}
              {i > 0 && (
                <div className={`${styles.connector} ${state === 'done' || state === 'active' ? styles.connectorFilled : ''}`} />
              )}

              {/* 노드 */}
              <div className={styles.node}>
                {state === 'done' ? (
                  <svg className={styles.checkIcon} viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                  </svg>
                ) : state === 'rejected' ? (
                  <svg className={styles.rejectIcon} viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
                  </svg>
                ) : (
                  <span className={styles.stepNumber}>{i + 1}</span>
                )}
              </div>

              {/* 라벨 */}
              <div className={styles.labelGroup}>
                <span className={styles.label}>{step.label}</span>
                <span className={styles.description}>{step.description}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 계약 유지 루프 힌트 (퍼포먼스 계열이고 running 상태일 때) */}
      {serviceType !== 'viral' && (projectStatus === 'running' || projectStatus === 'paused') && (
        <div className={styles.loopHint}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className={styles.loopIcon}>
            <path d="M5.5 3.5A1.5 1.5 0 017 2h2a1.5 1.5 0 011.5 1.5v1.25a.75.75 0 01-1.5 0V3.5H7v1.25a.75.75 0 01-1.5 0V3.5zM3.22 6.22a.75.75 0 011.06 0L6 7.94l1.72-1.72a.75.75 0 111.06 1.06l-2.25 2.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 010-1.06z" />
          </svg>
          계약 유지 시 사전 보고서 → 집행 단계가 반복됩니다
        </div>
      )}
    </section>
  );
}
