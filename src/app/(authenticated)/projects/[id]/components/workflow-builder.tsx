'use client';

/**
 * WorkflowBuilder - 6개 상태 그룹을 자유롭게 쌓아가는 워크플로우 UI
 *
 * 순서/개수 제한 없이 원하는 그룹을 자유롭게 추가·삭제할 수 있습니다.
 * 워크플로우 스택은 부모에서 관리하고, metadata.workflow_stack 에 저장됩니다.
 */

import { useState, useRef, useEffect } from 'react';
import { LuPlus, LuTrash2, LuExternalLink, LuRefreshCw } from 'react-icons/lu';
import type { ProjectStatus, ServiceType, DocumentType, DocumentStatus } from '@/lib/domain/types';
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
  F: '#ef4444', // 환불 - red
  G: '#6b7280', // 종료 - gray
};

const GROUP_MAP = Object.fromEntries(PROJECT_STATUS_GROUPS.map((g) => [g.key, g]));

/** 상태 코드에서 그룹 키 추출: 'B3_estimate_sent' → 'B' */
function statusToGroupKey(status: string): string {
  return status.charAt(0);
}

/** projectStatus로부터 워크플로우 스택을 추론 (metadata에 저장된 stack이 없을 때 폴백) */
function inferStackFromStatus(currentStatus: ProjectStatus): string[] {
  const allStatuses = Object.keys(PROJECT_STATUS_META) as ProjectStatus[];
  const currentIdx = allStatuses.indexOf(currentStatus);
  const result: string[] = [];
  for (const group of PROJECT_STATUS_GROUPS) {
    for (const s of group.statuses) {
      if (allStatuses.indexOf(s) <= currentIdx) {
        result.push(s);
      }
    }
  }
  return result;
}

/** 레거시/불완전한 스택을 정규화: 모든 세부 상태를 개별 엔트리로 확장.
 *  동일 그룹 연속 엔트리에서 인덱스가 역행(예: B3 → B1)하면 해당 지점에서
 *  새 세그먼트로 돌입(같은 그룹을 다시 추가한 경우 별개의 플로우로 취급). */
function normalizeStack(stack: string[], currentStatus: ProjectStatus): string[] {
  const expanded: string[] = [];
  for (const entry of stack) {
    if (entry.includes('_')) {
      expanded.push(entry);
    } else {
      const group = PROJECT_STATUS_GROUPS.find((g) => g.key === entry);
      if (group) expanded.push(group.statuses[group.statuses.length - 1]);
      else expanded.push(entry);
    }
  }

  const result: string[] = [];
  let i = 0;
  while (i < expanded.length) {
    const key = statusToGroupKey(expanded[i]);
    const group = PROJECT_STATUS_GROUPS.find((g) => g.key === key);
    if (!group) { result.push(expanded[i]); i++; continue; }

    // 하나의 세그먼트: 인덱스 역행 정지 지점까지
    let maxIdx = -1;
    let prevIdx = -1;
    while (i < expanded.length && statusToGroupKey(expanded[i]) === key) {
      const idx = group.statuses.indexOf(expanded[i] as ProjectStatus);
      if (idx < prevIdx) break; // 역행 → 세그먼트 끝
      if (idx > maxIdx) maxIdx = idx;
      prevIdx = idx;
      i++;
    }

    // 세그먼트 내 최대 도달 인덱스까지 개별 상태 확장
    for (let j = 0; j <= maxIdx; j++) {
      result.push(group.statuses[j]);
    }
  }

  if (result.length > 0) {
    const lastKey = statusToGroupKey(result[result.length - 1]);
    const currentKey = statusToGroupKey(currentStatus);
    if (currentKey === lastKey) {
      const group = PROJECT_STATUS_GROUPS.find((g) => g.key === currentKey);
      if (group) {
        const lastIdx = group.statuses.indexOf(result[result.length - 1] as ProjectStatus);
        const currentIdx = group.statuses.indexOf(currentStatus);
        for (let j = lastIdx + 1; j <= currentIdx; j++) {
          result.push(group.statuses[j]);
        }
      }
    }
  }

  return result;
}

/** 스택에서 그룹 세그먼트(연속된 동일 그룹 엔트리) 경계 계산.
 *  동일 그룹 엔트리의 인덱스가 역행(예: B3 → B1)하면 새 세그먼트로 분리 —
 *  같은 그룹이 연속해서 두 번 이상 추가된 경우 별개의 플로우로 표시하기 위함. */
function getGroupSegments(stack: string[]): { key: string; startIdx: number; endIdx: number }[] {
  const segments: { key: string; startIdx: number; endIdx: number }[] = [];
  for (let i = 0; i < stack.length; i++) {
    const key = statusToGroupKey(stack[i]);
    const group = PROJECT_STATUS_GROUPS.find((g) => g.key === key);
    const curIdx = group ? group.statuses.indexOf(stack[i] as ProjectStatus) : -1;
    const last = segments[segments.length - 1];
    if (last && last.key === key) {
      const prevIdx = group ? group.statuses.indexOf(stack[last.endIdx] as ProjectStatus) : -1;
      if (curIdx >= 0 && prevIdx >= 0 && curIdx < prevIdx) {
        // 인덱스 역행 → 별도 세그먼트
        segments.push({ key, startIdx: i, endIdx: i });
      } else {
        last.endIdx = i;
      }
    } else {
      segments.push({ key, startIdx: i, endIdx: i });
    }
  }
  return segments;
}

/** 스택 배열에서 표시용 그룹 데이터를 생성 (세그먼트 기반) */
function buildFromStack(stack: string[], currentStatus: ProjectStatus) {
  const segments = getGroupSegments(stack);

  // 동일 그룹 카운트 (넘버링용)
  const totalSegCount: Record<string, number> = {};
  for (const seg of segments) {
    totalSegCount[seg.key] = (totalSegCount[seg.key] ?? 0) + 1;
  }
  const segCountSoFar: Record<string, number> = {};

  return segments.map((seg, segIdx) => {
    const group = GROUP_MAP[seg.key];
    if (!group) return null;
    const isLast = segIdx === segments.length - 1;

    // 넘버링: 동일 그룹이 2개 이상일 때만 표시
    segCountSoFar[seg.key] = (segCountSoFar[seg.key] ?? 0) + 1;
    const flowNumber = totalSegCount[seg.key] > 1 ? segCountSoFar[seg.key] : null;

    // 세그먼트에 포함된 상태 목록
    const entrySet = new Set(stack.slice(seg.startIdx, seg.endIdx + 1));
    const lastEntry = stack[seg.endIdx];

    // 그룹 내 세부 상태별로 done/active/upcoming 판정
    const statusItems = group.statuses.map((s) => {
      let state: 'done' | 'active' | 'upcoming';
      if (isLast) {
        if (entrySet.has(s) && s !== lastEntry) state = 'done';
        else if (s === lastEntry) state = 'active';
        else state = 'upcoming';
      } else {
        state = 'done';
      }
      return { status: s, state };
    });

    return {
      groupKey: seg.key,
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

/** 승인 단계 status 목록 (B2, C2, E2) */
const REVIEW_STATUSES = new Set<string>(['B2_estimate_review', 'C2_contract_review', 'E2_prereport_review']);

interface WorkflowDocument {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  content: Record<string, any>;
}

/** 그룹 키 → 문서 타입 / 페이지 경로 매핑 */
const GROUP_NAV_MAP: Record<string, { docType: DocumentType; path: string; label: string }> = {
  B: { docType: 'estimate', path: '/estimates', label: '견적서 보기' },
  C: { docType: 'contract', path: '/contracts', label: '계약서 보기' },
  D: { docType: 'payment', path: '/payments', label: '입금 내역 보기' },
  E: { docType: 'pre_report', path: '/executions', label: '집행 보고서 보기' },
};

/** 스택에서 해당 그룹의 flow_number 계산 (세그먼트 기반: 동일 그룹 세그먼트가 여러 번 나올 때) */
function getFlowNumber(stack: string[], groupKey: string, segmentIndex: number): number {
  const segments = getGroupSegments(stack);
  let count = 0;
  for (let i = 0; i <= segmentIndex && i < segments.length; i++) {
    if (segments[i].key === groupKey) count++;
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
  onRefresh?: () => void;
}

export function WorkflowBuilder({ serviceType, projectStatus, workflowStack, manualStatuses, documents = [], onAdd, onDelete, onStatusChange, onRefresh }: WorkflowBuilderProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);

  // workflow_stack이 비어있으면 현재 status에서 추론 + 레거시 키 정규화
  const rawStack = workflowStack.length > 0 ? workflowStack : inferStackFromStatus(projectStatus);
  const effectiveStack = normalizeStack(rawStack, projectStatus);
  const stack = buildFromStack(effectiveStack, projectStatus);

  // 종료 상태면 추가 불가
  const isFinal = projectStatus === 'G1_closed';

  // 승인이 필요한 그룹: B(견적), C(계약), E(집행) — 문서 승인 전까지 다음 진행 차단
  const APPROVAL_REQUIRED_GROUPS: Record<string, DocumentType> = { B: 'estimate', C: 'contract', E: 'pre_report' };

  const lastGroup = stack.length > 0 ? stack[stack.length - 1] : null;
  const approvalBlocked = (() => {
    if (!lastGroup) return false;
    const docType = APPROVAL_REQUIRED_GROUPS[lastGroup.groupKey];
    if (!docType) return false;
    const flowNum = getFlowNumber(effectiveStack, lastGroup.groupKey, stack.length - 1);
    const doc = findDocForGroup(documents, lastGroup.groupKey, flowNum);
    if (!doc) return false;
    // approved 또는 sent 상태면 차단 해제
    return doc.status !== 'approved' && doc.status !== 'sent';
  })();

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
    if (approvalBlocked && item.state !== 'done') return; // 승인 전이면 전진 차단 (되돌리기는 허용)

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 className="section-title" style={{ margin: 0 }}>워크플로우</h2>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className={styles.refreshBtn}
            title="워크플로우 새로고침"
          >
            <LuRefreshCw size={14} />
          </button>
        )}
      </div>
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
                      // 승인 단계일 때 문서가 승인/발송 상태인지 확인
                      const isReviewStep = REVIEW_STATUSES.has(item.status);
                      const isDocApproved = isReviewStep && doc && (doc.status === 'approved' || doc.status === 'sent');
                      return (
                        <div
                          key={item.status}
                          className={`${styles.subStep} ${styles[`sub_${item.state}`]} ${isClickable ? styles.subClickable : ''} ${isSystem && navHref ? styles.subHoverable : ''}`}
                          onClick={isClickable ? () => handleSubClick(item, group, gIdx) : undefined}
                          role={isClickable ? 'button' : undefined}
                          tabIndex={isClickable ? 0 : undefined}
                        >
                          <div className={`${styles.subNode} ${isManual ? styles.subNodeManual : ''}`} style={isDocApproved ? { background: color, borderColor: color, color: '#fff' } : item.state === 'done' ? { background: color, borderColor: color } : item.state === 'active' ? { borderColor: color, color } : {}}>
                            {item.state === 'done' || isDocApproved ? (
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
          {!isFinal && !approvalBlocked && (
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
