'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 프로젝트 담당자(workflow_project_assignees) 권한 체크 훅.
 *
 * 사용 예:
 *   const { isAssignee, loading } = useProjectAssignees(projectId, currentUserId, projectOwnerId);
 *
 *   if (!isAssignee) {
 *     toast({ title: '담당자만 수행할 수 있는 작업입니다', variant: 'warning' });
 *     return;
 *   }
 *
 * 담당자 판정 규칙:
 *   - workflow_project_assignees 에 본인 user_id 가 있으면 담당자
 *   - 또는 workflow_projects.owner_id 가 본인이면 담당자 (서버 권한 정책과 일치)
 *   - 또는 owner_id 가 비어있으면 (담당자 미지정) 동일 조직 누구나 가능 → 담당자로 간주
 *
 * - projectId 또는 currentUserId 가 비어있으면 isAssignee = false.
 * - 동일 projectId 에 대한 결과는 컴포넌트 인스턴스 내에서 캐시.
 */
export function useProjectAssignees(
  projectId: string | null | undefined,
  currentUserId: string | null | undefined,
  projectOwnerId?: string | null,
) {
  const [assigneeIds, setAssigneeIds] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    if (!projectId) {
      setAssigneeIds(null);
      return;
    }
    const cached = cacheRef.current.get(projectId);
    if (cached) {
      setAssigneeIds(cached);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/projects/${projectId}/assignees`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<{ user_id: string }>) => {
        if (cancelled) return;
        const ids = new Set<string>(Array.isArray(data) ? data.map((a) => a.user_id) : []);
        cacheRef.current.set(projectId, ids);
        setAssigneeIds(ids);
      })
      .catch(() => {
        if (cancelled) return;
        const empty = new Set<string>();
        cacheRef.current.set(projectId, empty);
        setAssigneeIds(empty);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const isInAssigneesTable = !!(currentUserId && assigneeIds && assigneeIds.has(currentUserId));
  const isOwner = !!(currentUserId && projectOwnerId && projectOwnerId === currentUserId);
  // owner_id 가 비어있으면 동일 조직 누구나 가능 (서버 정책과 동일)
  const ownerUnassigned = projectOwnerId === '' || projectOwnerId === null || projectOwnerId === undefined;
  const isAssignee = !!currentUserId && (isInAssigneesTable || isOwner || ownerUnassigned);
  // 데이터가 아직 로드 중이면 isAssignee 판단을 보류하지 않고 false 처리하되,
  // assignees API 가 아예 응답하지 않은 상태(=null)는 ready=false 로 표시.
  const ready = assigneeIds !== null && !!currentUserId;

  return { isAssignee, ready, loading };
}
