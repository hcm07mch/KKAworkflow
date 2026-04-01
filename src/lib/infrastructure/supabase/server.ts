/**
 * Supabase SSR ?대쇱댁명?
 *
 * Next.js App Router? Server Component / Route Handler?? ?ъ?
 * 荑??湲곕? ?몄? ???쇰? ?쎄? 媛깆???
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

/**
 * Server Component / Route Handler??Supabase ?대쇱댁명?
 * ?泥留???濡 ??깊댁???(cookies()媛 ?泥 ?ㅼ??).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component??? 荑???ㅼ??遺媛??(?쎄린 ???.
            // Route Handler / Server Action??留 ?? ??.
          }
        },
      },
    },
  );
}
