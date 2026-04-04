'use client';

/**
 * WorkflowBuilder - 6개 상태 그룹을 자유롭게 쌓아가는 워크플로우 UI
 *
 * 순서/개수 제한 없이 원하는 그룹을 자유롭게 추가·삭제할 수 있습니다.
 * 워크플로우 스택은 부모에서 관리하고, metadata.workflow_stack 에 저장됩니다.
 */

import { useState, useRef, useEffect } from 'react';
import { LuPlus, LuTrash2 } from 'react-icons/lu';
import type { ProjectStatus, ServiceType } from '@/lib/domain/types';
import {
  PROJECT_STATUS_META,
  PROJECT_STATUS_GROUPS,
} from '@/lib/domain/types';
import styles from './workflow-builder.module.css';

// 각 그룹의 대표 색상
const GROUP_COLORS: Record<string, string> = {
  A: '#6b7280', // 영업 - gray
  B: '#3b82f6', // 견적 - blue
  C: '#8b5cf6', // 계약 - purple
  D: '#f59e0b', // 입금 - amber
  E: '#10b981', // 집행 - emerald
  F: '#ef4444', // 종료 - red
};

const GROUP_MAP = Object.fromEntries(PROJECT_STATUS_GROUPS.map((g) => [g.key, g]));

/** projectStatus로부터 워크플로우 스택을 추론 (metadata에 저장된 stack이 없을 때 폴백) */
function inferStackFromStatus(currentStatus: ProjectStatus): string[] {
  const allStatuses = Object.keys(PROJECT_STATUS_META) as ProjectStatus[];
  const currentIdx = allStatuses.indexOf(currentStatus);
  const keys: string[] = [];
  for (const group of PROJECT_STATUS_GROUPS) {
    const hasRelevant = group.statuses.some((s) => allStatuses.indexOf(s) <= currentIdx);
    if (hasRelevant) keys.push(group.key);
  }
  return keys;
}

/** 스택 배열에서 표시용 그룹 데이터를 생성 */
function buildFromStack(stack: string[], currentStatus: ProjectStatus) {
  const allStatuses = Object.keys(PROJECT_STATUS_META) as ProjectStatus[];
  const currentIdx = allStatuses.indexOf(currentStatus);

  return stack.map((key, idx) => {
    const group = GROUP_MAP[key];
    if (!group) return null;
    const isLast = idx === stack.length - 1;

    // 그룹 내 세부 상태별로 done/active/upcoming 판정
    const statusItems = group.statuses.map((s) => {
      const sIdx = allStatuses.indexOf(s);
      let state: 'done' | 'active' | 'upcoming';
      if (isLast) {
        // 현재(마지막) 그룹: 실제 상태 기준으로 판정
        if (sIdx < currentIdx) state = 'done';
        else if (sIdx === currentIdx) state = 'active';
        else state = 'upcoming';
      } else {
        // 이전 그룹: 모두 done
        state = 'done';
      }
      return { status: s, state };
    });

    return {
      groupKey: key,
      label: group.label,
      isCurrent: isLast,
      isDone: !isLast,
      statuses: statusItems,
    };
  }).filter(Boolean) as {
    groupKey: string;
    label: string;
    isCurrent: boolean;
    isDone: boolean;
    statuses: { status: ProjectStatus; state: 'done' | 'active' | 'upcoming' }[];
  }[];
}

interface WorkflowBuilderProps {
  serviceType: ServiceType;
  projectStatus: ProjectStatus;
  workflowStack: string[];
  manualStatuses: Set<string>;
  onAdd: (groupKey: string, paymentAmount?: number) => void;
  onDelete: (index: number) => void;
  onStatusChange: (toStatus: ProjectStatus) => void;
}

export function WorkflowBuilder({ serviceType, projectStatus, workflowStack, manualStatuses, onAdd, onDelete, onStatusChange }: WorkflowBuilderProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);

  // workflow_stack이 비어있으면 현재 status에서 추론
  const effectiveStack = workflowStack.length > 0 ? workflowStack : inferStackFromStatus(projectStatus);
  const stack = buildFromStack(effectiveStack, projectStatus);

  // 종료 상태면 추가 불가
  const isFinal = projectStatus === 'F2_closed';

  // 가장 최근 그룹이 보이도록 오른쪽 끝으로 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [workflowStack.length]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleSelect(group: typeof PROJECT_STATUS_GROUPS[number]) {
    if (group.key === 'D') {
      const amountStr = prompt('입금 받아야 할 금액을 입력하세요 (원)');
      if (amountStr === null) { setOpen(false); return; }
      const amount = parseInt(amountStr.replace(/[^0-9]/g, ''), 10);
      if (isNaN(amount) || amount <= 0) {
        alert('올바른 금액을 입력해주세요.');
        return;
      }
      onAdd(group.key, amount);
    } else {
      if (confirm(`워크플로우에 "${group.label}" 단계를 추가하시겠습니까?`)) {
        onAdd(group.key);
      }
    }
    setOpen(false);
  }

  function handleSubClick(item: { status: ProjectStatus; state: 'done' | 'active' | 'upcoming' }, group: typeof stack[number], gIdx: number) {
    if (!manualStatuses.has(item.status)) return;
    if (!group.isCurrent) return;

    const groupDef = GROUP_MAP[group.groupKey];
    if (!groupDef) return;

    if (item.state === 'done') {
      // 이미 완료된 상태 클릭 → 해당 상태로 되돌리기 (취소)
      onStatusChange(item.status);
      return;
    }

    const isLastInGroup = item.status === groupDef.statuses[groupDef.statuses.length - 1];
    const isLastGroup = gIdx === stack.length - 1;

    // 상태 변경: 다음 세부 상태로 전환, 마지막이면 그룹 마지막 상태로
    const statusIdx = groupDef.statuses.indexOf(item.status);
    const nextStatus = statusIdx < groupDef.statuses.length - 1
      ? groupDef.statuses[statusIdx + 1]
      : item.status; // 마지막 세부이면 해당 상태로 확정
    onStatusChange(nextStatus);

    // 그룹 마지막 세부 상태 체크 시 → 새 그룹 피커 열기
    if (isLastInGroup && isLastGroup) {
      setTimeout(() => {
        if (addBtnRef.current) {
          const rect = addBtnRef.current.getBoundingClientRect();
          setPickerPos({ top: rect.bottom + 8, left: rect.left });
        }
        setOpen(true);
      }, 300);
    }
  }

  function handleDelete(gIdx: number) {
    const group = stack[gIdx];
    if (!confirm(`"${group.label}" 단계를 삭제하시겠습니까?`)) return;
    onDelete(gIdx);
  }

  return (
    <>
      <h2 className="section-title">워크플로우</h2>
      <section className="card">

        <div className={styles.scrollContainer} ref={scrollRef}>
        <div className={styles.hStack}>
          {stack.length === 0 ? (
            <div className={styles.emptyHint}>
              오른쪽 + 버튼으로 워크플로우를 시작하세요
            </div>
          ) : (
            stack.map((group, gIdx) => {
              const color = GROUP_COLORS[group.groupKey] ?? '#6b7280';
              return (
                <div key={`${group.groupKey}-${gIdx}`} className={styles.column}>
                  {/* 그룹 헤더 */}
                  <div className={styles.columnHeader} style={{ borderColor: color }}>
                    <div
                      className={`${styles.nodeIcon} ${group.isDone ? styles.nodeDone : ''} ${group.isCurrent ? styles.nodeActive : ''}`}
                      style={group.isDone ? { background: color, borderColor: color } : group.isCurrent ? { borderColor: color, color } : {}}
                    >
                      {group.isDone ? (
                        <svg className={styles.checkIcon} viewBox="0 0 16 16" fill="currentColor">
                          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                        </svg>
                      ) : (
                        <span className={styles.stepIndex}>{gIdx + 1}</span>
                      )}
                    </div>
                    <span className={styles.groupName}>{group.label}</span>
                    {gIdx === stack.length - 1 && !(gIdx === 0 && group.groupKey === 'A') && (
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(gIdx)}
                        title="단계 삭제"
                      >
                        <LuTrash2 size={20} />
                      </button>
                    )}
                  </div>

                  {/* 세부 상태 목록 (세로) */}
                  <div className={styles.subSteps}>
                    {group.statuses.map((item) => {
                      const meta = PROJECT_STATUS_META[item.status];
                      const isManual = manualStatuses.has(item.status);
                      const isClickable = isManual && group.isCurrent;
                      return (
                        <div
                          key={item.status}
                          className={`${styles.subStep} ${styles[`sub_${item.state}`]} ${isClickable ? styles.subClickable : ''}`}
                          onClick={isClickable ? () => handleSubClick(item, group, gIdx) : undefined}
                          role={isClickable ? 'button' : undefined}
                          tabIndex={isClickable ? 0 : undefined}
                        >
                          <div className={`${styles.subNode} ${isManual ? styles.subNodeManual : ''}`} style={item.state === 'done' ? { background: color, borderColor: color } : item.state === 'active' ? { borderColor: color, color } : {}}>
                            {item.state === 'done' ? (
                              <svg className={styles.subCheckIcon} viewBox="0 0 16 16" fill="currentColor">
                                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                              </svg>
                            ) : (
                              <span className={styles.subDot} style={item.state === 'active' ? { background: color } : {}} />
                            )}
                          </div>
                          <span className={styles.subLabel}>{meta.shortLabel}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 그룹 간 화살표 커넥터 */}
                  {gIdx < stack.length - 1 && (
                    <div className={styles.arrowConnector}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M7 4l6 6-6 6" stroke="var(--color-border)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* 추가 버튼 */}
          {!isFinal && (
            <div className={styles.addColumn} ref={dropdownRef}>
              <button
                type="button"
                ref={addBtnRef}
                className={styles.addBtn}
                onClick={() => {
                  if (!open && addBtnRef.current) {
                    const rect = addBtnRef.current.getBoundingClientRect();
                    setPickerPos({ top: rect.bottom + 8, left: rect.left });
                  }
                  setOpen((v) => !v);
                }}
                title="단계 추가"
              >
                <LuPlus size={16} />
              </button>

              {open && pickerPos && (
                <div
                  className={styles.pickerNodes}
                  style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left }}
                >
                  {PROJECT_STATUS_GROUPS.map((group, i) => {
                    const color = GROUP_COLORS[group.key] ?? '#6b7280';
                    return (
                      <button
                        key={group.key}
                        type="button"
                        className={styles.pickerRow}
                        onClick={() => handleSelect(group)}
                        title={group.label}
                      >
                        <span
                          className={styles.pickerNode}
                          style={{ borderColor: color, color }}
                        >
                          {i + 1}
                        </span>
                        <span className={styles.pickerLabel} style={{ color }}>{group.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
    </>
  );
}
