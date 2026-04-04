'use client';

/**
 * WorkflowProgress - 15단계 프로젝트 워크플로우 시각화
 *
 * 서비스 유형별 플로우:
 * - 바이럴:           A → B1~B4 → D1~D2 → E4 (C단계, E1~E3 생략)
 * - 퍼포먼스/복합:    A → B1~B4 → C1~C4 → D1~D2 → E1~E4
 */

import type { ProjectStatus, ServiceType } from '@/lib/domain/types';
import { PROJECT_STATUS_META, PROJECT_STATUS_GROUPS, SERVICE_TYPE_META } from '@/lib/domain/types';
import styles from './workflow-progress.module.css';

/** 서비스 유형에 따라 표시할 상태 목록 결정 */
function getVisibleStatuses(serviceType: ServiceType, currentStatus: ProjectStatus): ProjectStatus[] {
  const base: ProjectStatus[] = serviceType === 'viral'
    ? [
        'A_sales',
        'B1_estimate_draft', 'B2_estimate_review', 'B3_estimate_sent', 'B4_estimate_response',
        'D1_payment_pending', 'D2_payment_confirmed',
        'E4_execution',
      ]
    : [
        'A_sales',
        'B1_estimate_draft', 'B2_estimate_review', 'B3_estimate_sent', 'B4_estimate_response',
        'C1_contract_draft', 'C2_contract_review', 'C3_contract_sent', 'C4_contract_signed',
        'D1_payment_pending', 'D2_payment_confirmed',
        'E1_prereport_draft', 'E2_prereport_review', 'E3_prereport_sent', 'E4_execution',
      ];

  if (currentStatus === 'F1_refund') base.push('F1_refund', 'F2_closed');
  else if (currentStatus === 'F2_closed') base.push('F2_closed');

  return base;
}

/** 현재 상태의 인덱스 */
function getActiveIndex(statuses: ProjectStatus[], current: ProjectStatus): number {
  const idx = statuses.indexOf(current);
  return idx >= 0 ? idx : 0;
}

type StepState = 'done' | 'active' | 'upcoming';

function getStepState(stepIndex: number, activeIndex: number): StepState {
  if (stepIndex < activeIndex) return 'done';
  if (stepIndex === activeIndex) return 'active';
  return 'upcoming';
}

/** 그룹 라벨과 해당 단계들을 묶어서 반환 */
function groupSteps(statuses: ProjectStatus[]) {
  const groups: { key: string; label: string; steps: ProjectStatus[] }[] = [];
  for (const s of statuses) {
    const group = PROJECT_STATUS_GROUPS.find(g => g.statuses.includes(s));
    if (!group) continue;
    const last = groups[groups.length - 1];
    if (last && last.key === group.key) {
      last.steps.push(s);
    } else {
      groups.push({ key: group.key, label: group.label, steps: [s] });
    }
  }
  return groups;
}

interface WorkflowProgressProps {
  serviceType: ServiceType;
  projectStatus: ProjectStatus;
}

export function WorkflowProgress({ serviceType, projectStatus }: WorkflowProgressProps) {
  const visibleStatuses = getVisibleStatuses(serviceType, projectStatus);
  const activeIndex = getActiveIndex(visibleStatuses, projectStatus);
  const allGroups = groupSteps(visibleStatuses);

  // 지나온 그룹 + 현재 속한 그룹까지만 표시 (미래 그룹 숨김)
  const groups = allGroups.filter((group) =>
    group.steps.some((s) => {
      const idx = visibleStatuses.indexOf(s);
      return idx <= activeIndex;
    })
  );

  return (
    <section className="card">
      <div className={styles.header}>
        <h2 className="section-title">워크플로우 진행 현황</h2>
        <span className={styles.serviceLabel}>
          {SERVICE_TYPE_META[serviceType].label} 플로우
        </span>
      </div>

      {/* 그룹별 스텝 타임라인 */}
      <div className={styles.timeline}>
        {groups.map((group) => (
          <div key={group.key} className={styles.group}>
            <span className={styles.groupLabel}>{group.label}</span>
            <div className={styles.groupSteps}>
              {group.steps.map((status) => {
                const globalIdx = visibleStatuses.indexOf(status);
                const state = getStepState(globalIdx, activeIndex);
                const meta = PROJECT_STATUS_META[status];
                return (
                  <div key={status} className={`${styles.step} ${styles[state]}`}>
                    {/* 커넥터 (그룹 내 첫 번째 제외) */}
                    {globalIdx > 0 && (
                      <div className={`${styles.connector} ${state === 'done' || state === 'active' ? styles.connectorFilled : ''}`} />
                    )}

                    {/* 노드 */}
                    <div className={styles.node}>
                      {state === 'done' ? (
                        <svg className={styles.checkIcon} viewBox="0 0 16 16" fill="currentColor">
                          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                        </svg>
                      ) : (
                        <span className={styles.stepNumber}>{globalIdx + 1}</span>
                      )}
                    </div>

                    {/* 라벨 */}
                    <div className={styles.labelGroup}>
                      <span className={styles.label}>{meta.shortLabel}</span>
                      <span className={styles.description}>{meta.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 계약 유지 루프 힌트 */}
      {serviceType !== 'viral' && projectStatus === 'E4_execution' && (
        <div className={styles.loopHint}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className={styles.loopIcon}>
            <path d="M5.5 3.5A1.5 1.5 0 017 2h2a1.5 1.5 0 011.5 1.5v1.25a.75.75 0 01-1.5 0V3.5H7v1.25a.75.75 0 01-1.5 0V3.5zM3.22 6.22a.75.75 0 011.06 0L6 7.94l1.72-1.72a.75.75 0 111.06 1.06l-2.25 2.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 010-1.06z" />
          </svg>
          계약 유지 시 E-1 사전 보고서 → E-4 집행 단계가 반복됩니다
        </div>
      )}
    </section>
  );
}
