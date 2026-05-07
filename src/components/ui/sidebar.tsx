'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LuLayoutDashboard,
  LuFolderOpen,
  LuBuilding2,
  LuFileText,
  LuFilePen,
  LuCreditCard,
  LuClipboardCheck,
  LuInbox,
  LuSettings,
} from 'react-icons/lu';
import type { IconType } from 'react-icons';
import styles from '@/app/(authenticated)/layout.module.css';

interface NavItem {
  href: string;
  label: string;
  icon: IconType;
}

/** 메뉴 그룹별 아이템 – 워크플로우 단계별 구성 */
const MENU_GROUPS: { items: NavItem[] }[] = [
  {
    items: [
      { href: '/',         label: '대시보드',  icon: LuLayoutDashboard },
    ],
  },
  {
    items: [
      { href: '/clients',    label: '고객 관리',  icon: LuBuilding2 },
      { href: '/projects',   label: '프로젝트',   icon: LuFolderOpen },
    ],
  },
  {
    items: [
      { href: '/estimates',  label: '견적서',     icon: LuFileText },
      { href: '/contracts',  label: '계약서',     icon: LuFilePen },
    ],
  },
  {
    items: [
      { href: '/payments',   label: '입금 확인',  icon: LuCreditCard },
      { href: '/executions',  label: '집행 관리',  icon: LuClipboardCheck },
    ],
  },
  {
    items: [
      { href: '/landing-inquiries', label: '랜딩 문의', icon: LuInbox },
    ],
  },
  {
    items: [
      { href: '/settings',   label: '설정',       icon: LuSettings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside className={styles.sidebar}>
      {/* Content (scrollable) */}
      <div className={styles.sidebarContent}>
        {MENU_GROUPS.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className={styles.sidebarDivider} />}
            <ul className={styles.sidebarGroup}>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`${styles.sidebarLink} ${active ? styles.sidebarLinkActive : ''}`}
                      title={item.label}
                    >
                      <span className={styles.sidebarIcon}><Icon size={18} /></span>
                      <span className={styles.sidebarLabel}>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}
