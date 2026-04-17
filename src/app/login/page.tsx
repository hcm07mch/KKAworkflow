'use client';

/**
 * 로그인 페이지
 *
 * 지원 방식:
 * - Email + Password
 */

import { Suspense, useRef, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/infrastructure/supabase/browser';
import styles from './login.module.css';

function getSupabase() {
  return createSupabaseBrowserClient();
}

const CALLBACK_ERRORS: Record<string, string> = {
  not_invited: '워크플로우 멤버로 등록되지 않았습니다.\n관리자에게 멤버 초대를 요청하세요.',
  auth_callback_failed: '인증 처리에 실패했습니다. 다시 시도해 주세요.',
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 파라미터 에러 처리 (OAuth callback 등)
  useEffect(() => {
    const errCode = searchParams.get('error');
    if (errCode && CALLBACK_ERRORS[errCode]) {
      setBlocked(CALLBACK_ERRORS[errCode]);
    }
  }, [searchParams]);

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
    setBlocked(null);

    const client = getClient();
    const { error: authError } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setLoading(false);
      setError(authError.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 올바르지 않습니다.' : authError.message);
      return;
    }

    // workflow_users 등록 확인
    const res = await fetch('/api/auth/ensure-user', { method: 'POST' });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const code = body?.error?.code;
      const message = body?.error?.message || '접근이 거부되었습니다.';

      // 인증 세션 제거 (워크플로우 접근 불가이므로 로그아웃)
      await client.auth.signOut();

      setLoading(false);

      if (code === 'NOT_INVITED' || code === 'DEACTIVATED' || code === 'NOT_REGISTERED') {
        setBlocked(message);
      } else {
        setError(message);
      }
      return;
    }

    setLoading(false);
    const redirectTo = new URLSearchParams(window.location.search).get('redirectTo') ?? '/';
    router.push(redirectTo);
    router.refresh();
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

          {blocked && (
            <div className={styles.blockedBox}>
              <div className={styles.blockedIcon}>⚠️</div>
              <p className={styles.blockedMessage}>{blocked}</p>
              <button
                type="button"
                className={styles.blockedDismiss}
                onClick={() => setBlocked(null)}
              >
                확인
              </button>
            </div>
          )}

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
