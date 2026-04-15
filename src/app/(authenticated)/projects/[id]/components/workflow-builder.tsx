'use client';

/**
 * WorkflowBuilder - 6개 상태 그룹을 자유롭게 쌓아가는 워크플로우 UI
 *
 * 순서/개수 제한 없이 원하는 그룹을 자유롭게 추가·삭제할 수 있습니다.
 * 워크플로우 스택은 부모에서 관리하고, metadata.workflow_stack 에 저장됩니다.
 */

import { useState, useRef, useEffect } from 'react';
import { LuPlus, LuTrash2, LuExternalLink } from 'react-icons/lu';
import type { ProjectStatus, ServiceType, DocumentType } from '@/lib/domain/types';
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

  // 동일 그룹 카운트 (넘버링용)
  const keyCountSoFar: Record<string, number> = {};
  const totalKeyCount: Record<string, number> = {};
  for (const key of stack) {
    totalKeyCount[key] = (totalKeyCount[key] ?? 0) + 1;
  }

  return stack.map((key, idx) => {
    const group = GROUP_MAP[key];
    if (!group) return null;
    const isLast = idx === stack.length - 1;

    // 넘버링: 동일 그룹이 2개 이상일 때만 표시
    keyCountSoFar[key] = (keyCountSoFar[key] ?? 0) + 1;
    const flowNumber = totalKeyCount[key] > 1 ? keyCountSoFar[key] : null;

    // 그룹 내 세부 상태별로 done/active/upcoming 판정
    const statusItems = group.statuses.map((s) => {
      const sIdx = allStatuses.indexOf(s);
      let state: 'done' | 'active' | 'upcoming';
      if (isLast) {
        if (sIdx < currentIdx) state = 'done';
        else if (sIdx === currentIdx) state = 'active';
        else state = 'upcoming';
      } else {
        state = 'done';
      }
      return { status: s, state };
    });

    return {
      groupKey: key,
      label: flowNumber ? `${group.label} #${flowNumber}` : group.label,
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

interface WorkflowDocument {
  id: string;
  type: DocumentType;
  content: Record<string, any>;
}

/** 그룹 키 → 문서 타입 / 페이지 경로 매핑 */
const GROUP_NAV_MAP: Record<string, { docType: DocumentType; path: string; label: string }> = {
  B: { docType: 'estimate', path: '/estimates', label: '견적서 보기' },
  C: { docType: 'contract', path: '/contracts', label: '계약서 보기' },
  D: { docType: 'payment', path: '/payments', label: '입금 내역 보기' },
  E: { docType: 'pre_report', path: '/executions', label: '집행 보고서 보기' },
};

/** 스택에서 해당 그룹의 flow_number 계산 (동일 그룹이 여러 번 나올 때) */
function getFlowNumber(stack: string[], groupKey: string, groupIndex: number): number {
  let count = 0;
  for (let i = 0; i <= groupIndex; i++) {
    if (stack[i] === groupKey) count++;
  }
  return count;
}

/** documents 중 해당 그룹/flow_number에 매칭되는 문서 찾기 */
function findDocForGroup(documents: WorkflowDocument[], groupKey: string, flowNumber: number): WorkflowDocument | null {
  const nav = GROUP_NAV_MAP[groupKey];
  if (!nav) return null;
  const docsOfType = documents.filter((d) => d.type === nav.docType);
  // flow_number가 있으면 매칭, 없으면 순서대로  
  const byFlow = docsOfType.find((d) => d.content?.flow_number === flowNumber);
  if (byFlow) return byFlow;
  // flow_number 없으면 n번째 문서
  return docsOfType[flowNumber - 1] ?? null;
}

interface WorkflowBuilderProps {
  serviceType: ServiceType;
  projectStatus: ProjectStatus;
  workflowStack: string[];
  manualStatuses: Set<string>;
  documents?: WorkflowDocument[];
  onAdd: (groupKey: string, paymentAmount?: number) => void;
  onDelete: (index: number) => void;
  onStatusChange: (toStatus: ProjectStatus) => void;
}

export function WorkflowBuilder({ serviceType, projectStatus, workflowStack, manualStatuses, documents = [], onAdd, onDelete, onStatusChange }: WorkflowBuilderProps) {
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
      // D 그룹은 부모에서 결제 모달을 표시하므로 바로 위임
      onAdd(group.key);
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
                      const isSystem = !isManual;
                      const nav = GROUP_NAV_MAP[group.groupKey];
                      const flowNum = getFlowNumber(effectiveStack, group.groupKey, gIdx);
                      const doc = nav ? findDocForGroup(documents, group.groupKey, flowNum) : null;
                      const navHref = nav && doc ? `${nav.path}?selected=${doc.id}` : null;
                      return (
                        <div
                          key={item.status}
                          className={`${styles.subStep} ${styles[`sub_${item.state}`]} ${isClickable ? styles.subClickable : ''} ${isSystem && navHref ? styles.subHoverable : ''}`}
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
                          {isSystem && navHref && (
                            <a
                              href={navHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.navLink}
                              onClick={(e) => e.stopPropagation()}
                              title={nav!.label}
                            >
                              <LuExternalLink size={12} />
                            </a>
                          )}
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
