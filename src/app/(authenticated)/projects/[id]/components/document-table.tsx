'use client';

/**
 * DocumentTable - 문서 목록 테이블 + 문서별 액션 버튼 + 다단계 승인 표시
 */

import { StatusBadge, ActionButton } from '@/components/ui';
import { DOCUMENT_TYPE_META, getAllowedDocumentTypes } from '@/lib/domain/types';
import { LuCheck } from 'react-icons/lu';
import type {
  ProjectDocument,
  ProjectStatus,
  DocumentType,
  UserRole,
  ServiceType,
} from '@/lib/domain/types';

export interface ApprovalProgressInfo {
  requiredSteps: number;
  completedSteps: number;
  currentStep: number | null;
  isFullyApproved: boolean;
  steps: { step: number; label: string | null; status: 'approved' | 'pending' | 'waiting' }[];
}

interface DocumentTableProps {
  documents: ProjectDocument[];
  projectStatus: ProjectStatus;
  serviceType: ServiceType;
  currentUserRole: UserRole;
  currentUserId: string;
  approvalProgress?: Record<string, ApprovalProgressInfo>;
  onCreateDocument?: (type: DocumentType) => void;
  onRequestApproval?: (documentId: string) => void;
  onApprove?: (documentId: string) => void;
  onReject?: (documentId: string) => void;
  onSend?: (documentId: string) => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 다단계 승인 진행 표시 */
function ApprovalSteps({ progress }: { progress?: ApprovalProgressInfo }) {
  if (!progress || progress.requiredSteps <= 1) return null;

  return (
    <div className="flex items-center gap-1 mt-1">
      {progress.steps.map((s) => (
        <span
          key={s.step}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
            s.status === 'approved'
              ? 'bg-green-50 text-green-700'
              : s.status === 'pending'
              ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
              : 'bg-gray-50 text-gray-400'
          }`}
          title={s.label ?? `${s.step}단계`}
        >
          {s.label ?? `${s.step}단계`}
          {s.status === 'approved' && <LuCheck size={10} className="inline ml-0.5" />}
        </span>
      ))}
      <span className="text-[10px] text-gray-400 ml-1">
        {progress.completedSteps}/{progress.requiredSteps}
      </span>
    </div>
  );
}

function DocumentActions({
  doc,
  currentUserRole,
  currentUserId,
  onRequestApproval,
  onApprove,
  onReject,
  onSend,
}: {
  doc: ProjectDocument;
  currentUserRole: UserRole;
  currentUserId: string;
  onRequestApproval?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onSend?: (id: string) => void;
}) {
  const isManagerOrAbove = currentUserRole === 'manager' || currentUserRole === 'admin';

  switch (doc.status) {
    case 'draft':
    case 'rejected':
      return (
        <ActionButton
          label="승인 요청"
          variant="primary"
          onClick={() => onRequestApproval?.(doc.id)}
        />
      );
    case 'in_review':
      return isManagerOrAbove ? (
        <div className="flex gap-1.5">
          <ActionButton label="승인" variant="primary" onClick={() => onApprove?.(doc.id)} />
          <ActionButton label="반려" variant="danger" onClick={() => onReject?.(doc.id)} />
        </div>
      ) : (
        <span className="text-xs text-gray-400">승인 대기중</span>
      );
    case 'approved':
      return (
        <ActionButton
          label="발송"
          variant="primary"
          onClick={() => onSend?.(doc.id)}
        />
      );
    case 'sent':
      return <span className="text-xs text-gray-400">발송 완료</span>;
    default:
      return null;
  }
}

export function DocumentTable({
  documents,
  projectStatus,
  serviceType,
  currentUserRole,
  currentUserId,
  approvalProgress,
  onCreateDocument,
  onRequestApproval,
  onApprove,
  onReject,
  onSend,
}: DocumentTableProps) {
  const allowedTypes = getAllowedDocumentTypes(projectStatus, serviceType);

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">문서 목록</h2>
        {allowedTypes.length > 0 && (
          <div className="flex gap-2">
            {allowedTypes.map((type) => (
              <ActionButton
                key={type}
                label={`${DOCUMENT_TYPE_META[type].label} 생성`}
                variant="secondary"
                onClick={() => onCreateDocument?.(type)}
              />
            ))}
          </div>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm">
          등록된 문서가 없습니다
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>구분</th>
                <th>제목</th>
                <th>상태</th>
                <th>버전</th>
                <th>최종 수정</th>
                <th className="text-right">액션</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <span className="text-xs font-medium text-gray-600">
                      {DOCUMENT_TYPE_META[doc.type].label}
                    </span>
                  </td>
                  <td className="font-medium text-gray-800">{doc.title}</td>
                  <td>
                    <StatusBadge status={doc.status} type="document" />
                    <ApprovalSteps progress={approvalProgress?.[doc.id]} />
                  </td>
                  <td className="text-gray-500">v{doc.version}</td>
                  <td className="text-gray-500 text-xs">{formatDateTime(doc.updated_at)}</td>
                  <td className="text-right">
                    <DocumentActions
                      doc={doc}
                      currentUserRole={currentUserRole}
                      currentUserId={currentUserId}
                      onRequestApproval={onRequestApproval}
                      onApprove={onApprove}
                      onReject={onReject}
                      onSend={onSend}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
