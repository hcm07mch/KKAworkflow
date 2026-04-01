'use client';

/**
 * 프로젝트 상세 페이지
 *
 * 구성:
 * - ProjectHeader: 기본 정보 + 상태 뱃지 + 상태 전환 버튼
 * - DocumentTable: 문서 목록 + 승인 진행 + 문서별 액션 버튼
 * - ActivityTimeline: 활동 로그 (최신순)
 */

import { useRouter } from 'next/navigation';
import { ProjectHeader, WorkflowProgress, DocumentTable, ActivityTimeline } from './components';
import {
  MOCK_PROJECT,
  MOCK_ACTIVITY_LOGS,
  MOCK_CURRENT_USER,
  MOCK_APPROVAL_PROGRESS,
} from './mock-data';
import type { ProjectStatus, DocumentType } from '@/lib/domain/types';

export default function ProjectDetailPage() {
  const router = useRouter();
  const project = MOCK_PROJECT;
  const logs = MOCK_ACTIVITY_LOGS;
  const currentUser = MOCK_CURRENT_USER;

  // ── Handlers (TODO: API 연결) ──────────────────────────

  function handleTransition(toStatus: ProjectStatus) {
    alert(`상태 변경: ${project.status} → ${toStatus}`);
  }

  function handleCreateDocument(type: DocumentType) {
    router.push(`/projects/${project.id}/documents/new?type=${type}`);
  }

  function handleRequestApproval(documentId: string) {
    alert(`승인 요청: ${documentId}`);
  }

  function handleApprove(documentId: string) {
    alert(`승인 처리: ${documentId}`);
  }

  function handleReject(documentId: string) {
    const reason = prompt('반려 사유를 입력해주세요.');
    if (reason) {
      alert(`반려 처리: ${documentId}, 사유: ${reason}`);
    }
  }

  function handleSend(documentId: string) {
    if (confirm('이 문서를 고객에게 발송하시겠습니까?')) {
      alert(`발송 처리: ${documentId}`);
    }
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="page-container">
      {/* 브레드크럼 */}
      <nav className="mb-4">
        <ol className="flex items-center text-xs text-gray-400 gap-1.5">
          <li><a href="/projects" className="hover:text-gray-600">프로젝트</a></li>
          <li>/</li>
          <li className="text-gray-600">{project.title}</li>
        </ol>
      </nav>

      {/* 프로젝트 기본 정보 + 상태 */}
      <ProjectHeader
        project={project}
        currentUserRole={currentUser.role}
        onTransition={handleTransition}
      />

      {/* 워크플로우 진행 현황 */}
      <WorkflowProgress
        serviceType={project.service_type}
        projectStatus={project.status}
      />

      {/* 문서 목록 */}
      <DocumentTable
        documents={project.documents}
        projectStatus={project.status}
        serviceType={project.service_type}
        currentUserRole={currentUser.role}
        currentUserId={currentUser.id}
        approvalProgress={MOCK_APPROVAL_PROGRESS}
        onCreateDocument={handleCreateDocument}
        onRequestApproval={handleRequestApproval}
        onApprove={handleApprove}
        onReject={handleReject}
        onSend={handleSend}
      />

      {/* 활동 로그 */}
      <ActivityTimeline logs={logs} />
    </div>
  );
}
