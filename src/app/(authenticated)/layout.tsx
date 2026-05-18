'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LuMenu, LuX } from 'react-icons/lu';
import { UserNav, Sidebar, ScopeSwitcher } from '@/components/ui';
import styles from './layout.module.css';

/**
 * 인증된 레이아웃 공통 레이아웃 (TopBar + Sidebar 구조)
 *
 * /login은 별도 레이아웃 반영이므로 TopBar가 표시되지 않음.
 *
 * 모바일(<= 768px): 사이드바가 기본 숨김. TopBar 의 햄버거 버튼으로 드로어 토글.
 * 데스크탑: 사이드바 고정 노출, hover 시 확장.
 */
export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // 경로 변경 시 드로어 자동 닫기
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // ESC 로 드로어 닫기
  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileNavOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  // 드로어 열려있을 때 body 스크롤 잠금
  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileNavOpen]);

  return (
    <div className={styles.appLayout}>
      {/* 상단 헤더 (전체 너비) */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button
            type="button"
            className={styles.mobileNavToggle}
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label={mobileNavOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <LuX size={20} /> : <LuMenu size={20} />}
          </button>
          <span className={styles.topBarBrand}>KKA Workflow</span>
        </div>
        <div className={styles.topBarRight}>
          <ScopeSwitcher />
          <UserNav />
        </div>
      </header>

      {/* 헤더 아래: 사이드바 + 메인 */}
      <div className={styles.bodyArea}>
        <Sidebar
          mobileOpen={mobileNavOpen}
          onNavigate={() => setMobileNavOpen(false)}
        />
        <div className={styles.sidebarSpacer} />
        {/* 모바일 드로어 백드롭 */}
        {mobileNavOpen && (
          <div
            className={styles.mobileBackdrop}
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}
        <main className={styles.appMain}>
          {children}
        </main>
      </div>
    </div>
  );
}
