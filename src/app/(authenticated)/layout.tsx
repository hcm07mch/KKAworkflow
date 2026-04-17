'use client';

import { UserNav, Sidebar } from '@/components/ui';
import styles from './layout.module.css';

/**
 * 인증된 레이아웃 공통 레이아웃 (TopBar + Sidebar 구조)
 *
 * /login은 별도 레이아웃 반영이므로 TopBar가 표시되지 않음.
 */
export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.appLayout}>
      {/* 상단 헤더 (전체 너비) */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <span className={styles.topBarBrand}>KKA Workflow</span>
        </div>
        <div className={styles.topBarRight}>
          <UserNav />
        </div>
      </header>

      {/* 헤더 아래: 사이드바 + 메인 */}
      <div className={styles.bodyArea}>
        <Sidebar />
        <div className={styles.sidebarSpacer} />
        <main className={styles.appMain}>
          {children}
        </main>
      </div>
    </div>
  );
}
