/**
 * Supabase Client ?ㅼ
 *
 * ?踰 ?ъ대(App Router)? ?대쇱댁명??ъ대?? 媛媛 ?ъ?
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// ---------------------------------------------------------------------------
// ?寃?蹂?
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ---------------------------------------------------------------------------
// ?대쇱댁명?(釉?쇱곗 + ?踰 而댄щ?몄? RLS ???
// ---------------------------------------------------------------------------

export function createSupabaseClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}

// ---------------------------------------------------------------------------
// ?鍮???대쇱댁명?(?踰 ??? RLS ?고 - ?鍮????댁??대? ?ъ?
// ---------------------------------------------------------------------------

export function createSupabaseServiceClient() {
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export type SupabaseClient = ReturnType<typeof createSupabaseClient>;
export type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;
