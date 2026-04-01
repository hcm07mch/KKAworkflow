/**
 * Extensions - Custom Hooks Interface
 *
 * ??щ? 而ㅼㅽ 濡吏? 二쇱? ? ?? ????ъ명?
 * Core ?鍮?ㅼ ??? 蹂寃쏀吏 ?怨 ?/? 濡吏? 異媛.
 *
 * ?ъ??:
 * - ?뱀 湲???댁 ?濡??몃 ???쇰? 2?④? ?뱀?
 * - 怨???猷 ? Slack ?由?諛??
 * - 寃ъ? ???? ?? 媛寃?怨??
 */

import type { Project, ProjectDocument, DocumentApproval, ProjectStatus, DocumentType } from '@/lib/domain/types';

// ============================================================================
// PROJECT HOOKS
// ============================================================================

export interface ProjectHooks {
  /** ?? ???? ?ㅽ (寃利/李⑤?媛?? */
  beforeTransition?: (project: Project, toStatus: ProjectStatus) => Promise<void>;

  /** ?? ???? ?ㅽ (?由??곕 ?? */
  afterTransition?: (project: Project, fromStatus: ProjectStatus) => Promise<void>;

  /** ?濡??????? ?ㅽ */
  afterCreate?: (project: Project) => Promise<void>;
}

// ============================================================================
// DOCUMENT HOOKS
// ============================================================================

export interface DocumentHooks {
  /** 臾몄 ???? 湲곕낯媛 二쇱 */
  beforeCreate?: (projectId: string, type: DocumentType, content: Record<string, unknown>) => Promise<Record<string, unknown>>;

  /** 臾몄 諛??? ?ㅽ (?대???諛?? ?몃? ??ㅽ ?곕 ?? */
  afterSend?: (document: ProjectDocument) => Promise<void>;

  /** ?뱀??猷 ? ?ㅽ */
  afterApprove?: (document: ProjectDocument, approval: DocumentApproval) => Promise<void>;
}

// ============================================================================
// DEFAULT (NO-OP) HOOKS
// ============================================================================

export const defaultProjectHooks: ProjectHooks = {};
export const defaultDocumentHooks: DocumentHooks = {};
