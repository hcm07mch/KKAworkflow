'use client';

/**
 * ProjectHeader - 프로젝트 기본 정보 + 상태 뱃지 + 상태 전환 버튼
 */

import { StatusBadge, ActionButton } from '@/components/ui';
import {
  PROJECT_STATUS_TRANSITIONS,
  PROJECT_STATUS_META,
  SERVICE_TYPE_META,
} from '@/lib/domain/types';
import type { ProjectWithRelations, UserRole, ProjectStatus } from '@/lib/domain/types';

interface ProjectHeaderProps {
  project: ProjectWithRelations;
  currentUserRole: UserRole;
  onTransition?: (toStatus: ProjectStatus) => void;
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return '-';
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function ProjectHeader({ project, currentUserRole, onTransition }: ProjectHeaderProps) {
  const nextStatuses = PROJECT_STATUS_TRANSITIONS[project.status];

  return (
    <section className="card">
      {/* 상단: 프로젝트 코드 + 상태 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {project.code && (
            <span className="text-xs font-mono text-gray-400">{project.code}</span>
          )}
          <StatusBadge status={project.status} type="project" size="md" />
        </div>
        {/* 상태 전환 버튼들 */}
        {nextStatuses.length > 0 && (
          <div className="flex gap-2">
            {nextStatuses.map((next) => (
              <ActionButton
                key={next}
                label={`${PROJECT_STATUS_META[next].label}(으)로 변경`}
                variant={next === 'G1_refund' ? 'danger' : 'primary'}
                size="sm"
                onClick={() => onTransition?.(next)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 프로젝트 제목 */}
      <h1 className="text-xl font-semibold text-gray-900 mb-1">{project.title}</h1>
      {project.description && (
        <p className="text-sm text-gray-500 mb-4">{project.description}</p>
      )}

      {/* 기본 정보 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <dt className="text-gray-400 mb-0.5">고객사</dt>
          <dd className="font-medium text-gray-800">{project.client.name}</dd>
        </div>
        <div>
          <dt className="text-gray-400 mb-0.5">서비스 유형</dt>
          <dd className="font-medium text-gray-800">{SERVICE_TYPE_META[project.service_type].label}</dd>
        </div>
        <div>
          <dt className="text-gray-400 mb-0.5">담당자</dt>
          <dd className="font-medium text-gray-800">{project.owner?.name ?? '미지정'}</dd>
        </div>
        <div>
          <dt className="text-gray-400 mb-0.5">계약 금액</dt>
          <dd className="font-medium text-gray-800">{formatCurrency(project.total_amount)}</dd>
        </div>
        <div>
          <dt className="text-gray-400 mb-0.5">기간</dt>
          <dd className="font-medium text-gray-800">
            {formatDate(project.start_date)} ~ {formatDate(project.end_date)}
          </dd>
        </div>
      </div>
    </section>
  );
}
