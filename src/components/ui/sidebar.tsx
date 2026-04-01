'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LuLayoutDashboard,
  LuFolderOpen,
  LuBuilding2,
  LuSettings,
} from 'react-icons/lu';
import type { IconType } from 'react-icons';
import styles from '@/app/(authenticated)/layout.module.css';

interface NavItem {
  href: string;
  label: string;
  icon: IconType;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/',         label: '대시보드',  icon: LuLayoutDashboard },
  { href: '/projects', label: '프로젝트',  icon: LuFolderOpen },
  { href: '/clients',  label: '고객사',    icon: LuBuilding2 },
  { href: '/settings', label: '설정',      icon: LuSettings },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside className={styles.sidebar}>
      {/* Brand Icon */}
      <Link href="/" className={styles.sidebarBrand}>K</Link>

      {/* Navigation */}
      <nav className={styles.sidebarNav}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.sidebarLink} ${isActive(item.href) ? styles.sidebarLinkActive : ''}`}
              title={item.label}
            >
              <span className={styles.sidebarIcon}><Icon size={20} /></span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
