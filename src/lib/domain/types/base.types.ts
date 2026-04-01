/**
 * 怨듯?湲곕? ??
 *
 * 紐⑤ ?硫????고곌? 怨듭?? 湲곕낯 ?? ??.
 * Supabase row 援ъ“? 1:1 留ㅼ묶 + ?鍮????댁댁? ?ъъ?
 */

// ============================================================================
// BASE TYPES
// ============================================================================

/** 紐⑤ ??고곗 怨듯??? */
export interface BaseEntity {
  id: string;
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
}

/** created_at留 媛吏? ??고?(activity_logs, document_approvals ?? */
export interface BaseImmutableEntity {
  id: string;
  created_at: string;
}

/** organization ?? ??고?*/
export interface OrgScopedEntity extends BaseEntity {
  organization_id: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/** JSON ????? (metadata, content, settings ?? */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = Record<string, JsonValue>;

/** Supabase ??듭? 愿怨 ?곗댄곕? ?ы⑦ ? ?ъ?*/
export type WithRelation<T, K extends string, R> = T & { [P in K]: R };

/** ???? ?踰?? ?? ?ㅼ?? ?? ???*/
export type CreateInput<T> = Omit<T, 'id' | 'created_at' | 'updated_at'>;

/** ?? ? 蹂寃?遺媛?ν ?? ??? ?癒몄?? ??? */
export type UpdateInput<T, ImmutableKeys extends keyof T = never> = Partial<
  Omit<T, 'id' | 'created_at' | 'updated_at' | ImmutableKeys>
>;

// ============================================================================
// PAGINATION
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// SERVICE RESULT
// ============================================================================

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
