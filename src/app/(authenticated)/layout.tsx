'use client';

import { UserNav, Sidebar, NotificationBell } from '@/components/ui';
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
      <Sidebar />
      <main className={styles.appMain}>
        <header className={styles.topBar}>
          <div className={styles.topBarRight}>
            <NotificationBell />
            <UserNav />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
