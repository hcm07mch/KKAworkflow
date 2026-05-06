/**
 * Workflow Group ↔ Document Type 매핑 (단일 진실 공급원)
 *
 * 워크플로우의 그룹(B/C/D/E 등)과 문서 타입(estimate/contract/payment/pre_report)
 * 사이의 매핑이 여러 곳에 흩어져 있어 변경 시 누락이 발생하기 쉬웠다.
 * 이 모듈을 모든 매핑의 단일 출처로 사용한다.
 *
 * DB 측 매칭은 함수 `document_type_to_group_key(text)` 가 동일한 매핑을 수행한다
 * (00028_segments_extensible 마이그레이션 참조). 변경 시 양쪽을 함께 갱신할 것.
 */

import type { DocumentType } from './status.types';

/** 워크플로우 그룹 키 (PROJECT_STATUS_GROUPS.key 와 동일). */
export type WorkflowGroupKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

/** 그룹별 문서 메타. 그룹이 문서를 가지지 않으면 항목이 없다. */
export interface WorkflowGroupDocumentMeta {
  /** 문서 타입 (workflow_project_documents.type). */
  docType: DocumentType;
  /** 문서 라벨 (UI 노출). */
  label: string;
  /** 자동 생성 시 제목 접미사 (`{프로젝트명} {suffix}`). */
  titleSuffix: string;
  /** 해당 문서를 다루는 페이지 경로. 견적서 보기 등 navigation 용. */
  navPath: string;
  /** "{label} 보기" 형태의 nav 라벨. */
  navLabel: string;
}

/**
 * 문서를 가지는 그룹의 메타. 문서가 없는 그룹(A/F/G/H)은 키 자체가 없다.
 *
 * 새 그룹/문서 타입을 추가하려면:
 *   1) 이 객체에 항목 추가
 *   2) DB 함수 document_type_to_group_key 갱신 (마이그레이션)
 *   3) PROJECT_STATUS_GROUPS / DOCUMENT_TYPES 등 도메인 상수 갱신
 */
export const WORKFLOW_GROUP_DOC_MAP = {
  B: {
    docType: 'estimate',
    label: '견적서',
    titleSuffix: '견적서',
    navPath: '/estimates',
    navLabel: '견적서 보기',
  },
  C: {
    docType: 'contract',
    label: '계약서',
    titleSuffix: '계약서',
    navPath: '/contracts',
    navLabel: '계약서 보기',
  },
  D: {
    docType: 'payment',
    label: '입금확인',
    titleSuffix: '입금확인',
    navPath: '/payments',
    navLabel: '입금 내역 보기',
  },
  E: {
    docType: 'pre_report',
    label: '사전보고서',
    titleSuffix: '사전보고서',
    navPath: '/executions',
    navLabel: '집행 보고서 보기',
  },
} as const satisfies Partial<Record<WorkflowGroupKey, WorkflowGroupDocumentMeta>>;

/** 문서 타입 → 그룹 키 역매핑 (런타임 빌드). */
const DOC_TYPE_TO_GROUP: Partial<Record<DocumentType, WorkflowGroupKey>> = (() => {
  const m: Partial<Record<DocumentType, WorkflowGroupKey>> = {};
  for (const [gk, meta] of Object.entries(WORKFLOW_GROUP_DOC_MAP) as [
    WorkflowGroupKey,
    WorkflowGroupDocumentMeta,
  ][]) {
    m[meta.docType] = gk;
  }
  return m;
})();

/** 문서 타입 → 그룹 키. 매칭 없으면 null. */
export function documentTypeToGroupKey(type: DocumentType): WorkflowGroupKey | null {
  return DOC_TYPE_TO_GROUP[type] ?? null;
}

/** 그룹 키 → 문서 메타. 그룹이 문서를 갖지 않으면 null. */
export function groupKeyToDocumentMeta(
  groupKey: string,
): WorkflowGroupDocumentMeta | null {
  return (WORKFLOW_GROUP_DOC_MAP as Record<string, WorkflowGroupDocumentMeta>)[groupKey] ?? null;
}
