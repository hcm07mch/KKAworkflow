'use client';

/**
 * UserNav - 사용자 정보 표시 + 로그아웃 버튼
 *
 * 인증된 레이아웃 TopBar에 배치.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/infrastructure/supabase/browser';
import styles from './user-nav.module.css';

interface UserInfo {
  email: string;
  name: string;
}

export function UserNav() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        setUser({
          email: authUser.email ?? '',
          name: authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? '',
        });
      }
    });
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  if (!user) return null;

  const initials = user.name.slice(0, 1).toUpperCase();

  return (
    <div className={styles.wrapper}>
      <div className={styles.avatar}>{initials}</div>
      <div className={styles.info}>
        <span className={styles.name}>{user.name}</span>
        <span className={styles.email}>{user.email}</span>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className={styles.logoutBtn}
      >
        {loggingOut ? '로그아웃 중...' : '로그아웃'}
      </button>
    </div>
  );
}
