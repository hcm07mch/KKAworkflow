'use client';

/**
 * FullScreenLoader — 화면 전체를 덮는 로딩 오버레이
 *
 * 사용법:
 *   <FullScreenLoader visible={isLoading} message="견적서를 제출하고 있습니다..." />
 *
 * Props:
 *   - visible: 표시 여부
 *   - message: 로딩 메시지 (선택)
 */

import s from './full-screen-loader.module.css';

interface FullScreenLoaderProps {
  visible: boolean;
  message?: string;
}

export function FullScreenLoader({ visible, message }: FullScreenLoaderProps) {
  if (!visible) return null;

  return (
    <div className={s.overlay}>
      <svg className={s.spinner} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {message && <p className={s.message}>{message}</p>}
    </div>
  );
}
