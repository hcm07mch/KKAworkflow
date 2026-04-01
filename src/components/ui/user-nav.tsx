'use client';

/**
 * UserNav - 아바타 버튼 클릭 → 드롭다운 (계정 정보, 테마 토글, 로그아웃)
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LuSun, LuMoon, LuLogOut } from 'react-icons/lu';
import { createSupabaseBrowserClient } from '@/lib/infrastructure/supabase/browser';
import styles from './user-nav.module.css';

type Theme = 'light' | 'dark';

interface UserInfo {
  email: string;
  name: string;
}

export function UserNav() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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

  // Restore saved theme
  useEffect(() => {
    const saved = (localStorage.getItem('theme') as Theme) || 'light';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const applyTheme = useCallback((t: Theme) => {
    setTheme(t);
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
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
    <div className={styles.wrapper} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className={styles.avatar}>{initials}</span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          {/* 계정 정보 */}
          <div className={styles.accountSection}>
            <span className={styles.avatar}>{initials}</span>
            <div className={styles.accountInfo}>
              <span className={styles.name}>{user.name}</span>
              <span className={styles.email}>{user.email}</span>
            </div>
          </div>

          <div className={styles.divider} />

          {/* 테마 선택 */}
          <div className={styles.themeSection}>
            <span className={styles.themeSectionLabel}>Theme</span>
            <div className={styles.themeOptions}>
              <button
                type="button"
                className={`${styles.themeOption} ${theme === 'light' ? styles.themeOptionActive : ''}`}
                onClick={() => applyTheme('light')}
              >
                <LuSun size={14} />
                <span>Light</span>
              </button>
              <button
                type="button"
                className={`${styles.themeOption} ${theme === 'dark' ? styles.themeOptionActive : ''}`}
                onClick={() => applyTheme('dark')}
              >
                <LuMoon size={14} />
                <span>Dark</span>
              </button>
            </div>
          </div>

          <div className={styles.divider} />

          {/* 로그아웃 */}
          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LuLogOut size={16} />
            <span>{loggingOut ? '로그아웃 중...' : '로그아웃'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
