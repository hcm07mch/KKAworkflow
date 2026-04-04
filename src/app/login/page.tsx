'use client';

/**
 * 로그인 페이지
 *
 * 지원 방식:
 * - Email + Password
 */

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/infrastructure/supabase/browser';
import styles from './login.module.css';

function getSupabase() {
  return createSupabaseBrowserClient();
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // lazy init 으로 서버 사이드 렌더링에서만 안전하게 처리
  const supabaseRef = useRef<ReturnType<typeof getSupabase> | null>(null);
  function getClient() {
    if (!supabaseRef.current) {
      supabaseRef.current = getSupabase();
    }
    return supabaseRef.current;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await getClient().auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else {
      // DB 사용자 동기화 (첫 로그인 시 자동 생성)
      await fetch('/api/auth/ensure-user', { method: 'POST' });

      const redirectTo = new URLSearchParams(window.location.search).get('redirectTo') ?? '/';
      router.push(redirectTo);
      router.refresh();
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* 헤더 */}
        <div className={styles.header}>
          <h1 className={styles.title}>KKA Workflow</h1>
          <p className={styles.subtitle}>업무 관리 시스템에 로그인</p>
        </div>

        {/* 이메일 + 비밀번호 폼 */}
        <form onSubmit={handleLogin} className={styles.form}>
          <div>
            <label htmlFor="email" className={styles.label}>
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.co.kr"
              required
              autoFocus
              className="form-input"
            />
          </div>

          <div>
            <label htmlFor="password" className={styles.label}>
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              required
              className="form-input"
            />
          </div>

          {error && (
            <p className={styles.error}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className={styles.button}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
