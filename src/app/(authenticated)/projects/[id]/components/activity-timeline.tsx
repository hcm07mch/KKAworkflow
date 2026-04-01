'use client';

/**
 * ActivityTimeline - 활동 로그 타임라인
 */

import type { ActivityLog } from '@/lib/domain/types';
import type { ReactNode } from 'react';
import {
  LuFilePlus,
  LuCircleCheck,
  LuCircleX,
  LuSend,
  LuRefreshCw,
  LuRepeat,
  LuPencil,
  LuBan,
  LuPin,
} from 'react-icons/lu';

interface ActivityTimelineProps {
  logs: (ActivityLog & { actor_name: string })[];
}

const ACTION_ICON: Record<string, ReactNode> = {
  create:     <LuFilePlus size={16} className="text-gray-500" />,
  approve:    <LuCircleCheck size={16} className="text-green-600" />,
  reject:     <LuCircleX size={16} className="text-red-500" />,
  send:       <LuSend size={16} className="text-blue-500" />,
  transition: <LuRefreshCw size={16} className="text-amber-500" />,
  resubmit:   <LuRepeat size={16} className="text-indigo-500" />,
  update:     <LuPencil size={16} className="text-gray-500" />,
  cancel:     <LuBan size={16} className="text-red-400" />,
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActivityTimeline({ logs }: ActivityTimelineProps) {
  // 최신순 정렬
  const sorted = [...logs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <section className="card">
      <h2 className="section-title mb-4">활동 로그</h2>

      {sorted.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm">
          활동 로그가 없습니다
        </div>
      ) : (
        <div className="space-y-0">
          {sorted.map((log) => (
            <div key={log.id} className="flex gap-3 py-2.5 border-b border-gray-50 last:border-0">
              {/* Icon */}
              <span className="text-base mt-0.5 shrink-0" aria-hidden>
                {ACTION_ICON[log.action] ?? <LuPin size={16} className="text-gray-400" />}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-gray-900">{log.actor_name}</span>
                  <span className="ml-1">{log.description}</span>
                </p>
                <time className="text-xs text-gray-400 mt-0.5 block">
                  {formatRelativeTime(log.created_at)}
                </time>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
