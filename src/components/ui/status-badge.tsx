/**
 * StatusBadge - ?? 諭吏 怨듯?而댄щ??
 */

import type { ProjectStatus, DocumentStatus } from '@/lib/domain/types';
import { PROJECT_STATUS_META, DOCUMENT_STATUS_META } from '@/lib/domain/types';

// Tailwind color ? CSS class mapping
const COLOR_MAP: Record<string, string> = {
  gray:    'badge-gray',
  blue:    'badge-blue',
  red:     'badge-red',
  indigo:  'badge-indigo',
  emerald: 'badge-emerald',
  yellow:  'badge-yellow',
  orange:  'badge-orange',
  green:   'badge-green',
  pink:    'badge-pink',
  slate:   'badge-slate',
};

interface StatusBadgeProps {
  status: ProjectStatus | DocumentStatus;
  type: 'project' | 'document';
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, type, size = 'sm' }: StatusBadgeProps) {
  const meta = type === 'project'
    ? PROJECT_STATUS_META[status as ProjectStatus]
    : DOCUMENT_STATUS_META[status as DocumentStatus];

  const colorClass = COLOR_MAP[meta.color] ?? 'badge-gray';
  const sizeClass = size === 'md' ? 'badge-md' : 'badge-sm';

  return (
    <span className={`badge ${colorClass} ${sizeClass}`} title={meta.description}>
      {meta.label}
    </span>
  );
}
