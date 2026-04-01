'use client';

/**
 * NotificationBell - 알림 벨 버튼 + 드롭다운 패널
 *
 * 인스타그램 스타일 알림 시스템
 * - 벨 버튼 + 읽지 않은 수 뱃지
 * - 클릭 시 알림 목록 패널 표시
 * - 알림 클릭 시 해당 프로젝트로 이동
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LuBell } from 'react-icons/lu';
import styles from './notification-bell.module.css';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
  project: { id: string; title: string; code: string | null; status: string } | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) {
        // 401/403 → 인증·사용자 문제이므로 폴링 중단
        if (res.status === 401 || res.status === 403) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
        return;
      }
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silent
    }
  }, []);

  // 초기 로드 + 30초 폴링
  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  function handleToggle() {
    setOpen((prev) => !prev);
    if (!open) fetchNotifications();
  }

  async function handleReadAll() {
    setLoading(true);
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    setLoading(false);
  }

  async function handleClickItem(item: NotificationItem) {
    // 읽음 처리
    if (!item.is_read) {
      fetch(`/api/notifications/${item.id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (item.link) {
      router.push(item.link);
    }
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.bellBtn}
        onClick={handleToggle}
        aria-label="알림"
      >
        <LuBell size={18} />
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className={styles.overlay} onClick={() => setOpen(false)} />
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>알림</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className={styles.readAllBtn}
                  onClick={handleReadAll}
                  disabled={loading}
                >
                  모두 읽음
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className={styles.empty}>새로운 알림이 없습니다</div>
            ) : (
              <ul className={styles.list}>
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`${styles.item} ${!n.is_read ? styles.itemUnread : ''}`}
                    onClick={() => handleClickItem(n)}
                  >
                    <span className={`${styles.dot} ${n.is_read ? styles.dotRead : ''}`} />
                    <div className={styles.itemContent}>
                      <div className={styles.itemTitle}>{n.title}</div>
                      <div className={styles.itemMeta}>
                        {n.project && (
                          <span className={styles.itemProject}>
                            {n.project.code ?? n.project.title}
                          </span>
                        )}
                        <span className={styles.itemTime}>{timeAgo(n.created_at)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
