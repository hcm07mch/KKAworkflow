/**
 * Extensions - Custom Validators
 *
 * ??щ? 寃利 洹移? 異媛? ? ?? ????ъ명?
 * Core? 湲곕낯 寃利 ?? 異媛 寃利? ??댁대?.
 *
 * ?ㅻ④? ?뱀??④? ?/??/怨痢듭 Core? approval_policies ??대??? 愿由?
 * Extension? 議곌굔遺 ?뱀?湲??湲곕? ?? 媛? ??????鍮利???濡吏留 ?대?
 */

import type { ProjectStatus, DocumentType } from '@/lib/domain/types';

// ============================================================================
// CUSTOM APPROVAL CONDITION (議곌굔遺 ?뱀?
// ============================================================================

export interface ApprovalConditionConfig {
  /** ??議곌굔? ?대뱁硫??뱀??? (false ? ?뱀??ㅽ? */
  condition: (context: { totalAmount?: number; [key: string]: unknown }) => boolean;

  /** 議곌굔 ?ㅻ? (UI ???? */
  description: string;
}

/**
 * 臾몄 ??蹂 議곌굔遺 ?뱀?洹移 (湲곕낯: ?? = ?? ?뱀???)
 * ??щ?濡 override 媛??
 *
 * ??:
 *   estimate: { condition: (ctx) => (ctx.totalAmount ?? 0) >= 1_000_000, description: '100留? ?댁' }
 */
export const defaultApprovalConditions: Partial<Record<DocumentType, ApprovalConditionConfig>> = {};

// ============================================================================
// CUSTOM STATUS TRANSITION RULES
// ============================================================================

export interface TransitionRuleConfig {
  /** ????댁 ??? 異媛 議곌굔 */
  condition?: (context: { projectId: string; [key: string]: unknown }) => Promise<boolean>;

  /** ????ㅽ?? 硫?吏 */
  failMessage?: string;
}

/** ??щ? 異媛 ???議곌굔 (湲곕낯: ??) */
export type CustomTransitionRules = Partial<
  Record<ProjectStatus, Partial<Record<ProjectStatus, TransitionRuleConfig>>>
>;

export const defaultTransitionRules: CustomTransitionRules = {};
