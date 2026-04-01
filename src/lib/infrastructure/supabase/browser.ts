/**
 * 釉?쇱곗??Supabase ?대쇱댁명?(?깃???
 *
 * Client Component?? Auth ?몄?(濡洹몄? 濡洹몄? ??? ?ъ?
 * SSR ?대쇱댁명?server.ts)? 遺由?? 釉?쇱곗??留 import.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
