'use client';

/**
 * ApprovalPanel — 견적서 승인/반려 패널
 *
 * 문서가 in_review 상태일 때 표시.
 * - 다단계 승인 진행 상황 표시
 * - manager/admin 역할을 가진 사용자에게 승인/반려 버튼 제공
 * - 승인 이력 표시
 */

import { useState, useEffect, useCallback } from 'react';
import { LuCheck, LuX, LuClock, LuShieldCheck, LuChevronUp, LuLoader, LuRotateCcw, LuHistory } from 'react-icons/lu';
import { ActionButton, useFeedback } from '@/components/ui';
import s from './estimate-editor.module.css';

interface ApprovalProgressStep {
  step: number;
  label: string | null;
  status: 'approved' | 'pending' | 'waiting';
  assigned_user_id: string | null;
}

interface ApprovalProgress {
  requiredSteps: number;
  completedSteps: number;
  currentStep: number | null;
  isFullyApproved: boolean;
  steps: ApprovalProgressStep[];
}

interface ApprovalHistoryItem {
  id: string;
  step: number;
  action: 'approve' | 'reject' | 'cancel' | null;
  requested_by: string | null;
  approver_id: string | null;
  requested_at: string;
  actioned_at: string | null;
  comment: string | null;
  metadata: Record<string, unknown>;
}

interface UserInfo {
  id: string;
  role: string;
}

interface ApprovalPanelProps {
  documentId: string;
  documentStatus: string;
  refreshKey?: number;
  onStatusChange?: (newStatus: string) => void;
}

// ── Helpers ──────────────────────────────────────────────

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── Component ────────────────────────────────────────────

export function ApprovalPanel({ documentId, documentStatus, refreshKey, onStatusChange }: ApprovalPanelProps) {
  const { toast, confirm } = useFeedback();
  const [progress, setProgress] = useState<ApprovalProgress | null>(null);
  const [history, setHistory] = useState<ApprovalHistoryItem[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(true);
  const [revertingStep, setRevertingStep] = useState<number | null>(null);

  // Fetch user info, approval progress, and history
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [progressRes, historyRes, userRes] = await Promise.all([
        fetch(`/api/documents/${documentId}/approvals/progress`),
        fetch(`/api/documents/${documentId}/approvals`),
        fetch('/api/auth/me'),
      ]);

      if (progressRes.ok) {
        const data = await progressRes.json();
        setProgress(data);
      } else {
        console.error('[ApprovalPanel] progress API failed:', progressRes.status, await progressRes.text().catch(() => ''));
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(Array.isArray(data) ? data : []);
      } else {
        console.error('[ApprovalPanel] history API failed:', historyRes.status, await historyRes.text().catch(() => ''));
      }
      if (userRes.ok) {
        const data = await userRes.json();
        setUserInfo({ id: data.id, role: data.role });
      } else {
        console.error('[ApprovalPanel] auth/me API failed:', userRes.status);
      }
    } catch (err) {
      console.error('[ApprovalPanel] fetchData error:', err);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (documentStatus !== 'draft') {
      fetchData();
    }
  }, [documentStatus, refreshKey, fetchData]);

  // Find the pending approval in history (현재 pending 단계에 해당하는 것만)
  const pendingStep = progress?.steps.find((s) => s.status === 'pending');
  const pendingApproval = pendingStep
    ? history.find((h) => h.action === null && h.step === pendingStep.step)
    : null;
  const isRoleAllowed = userInfo && (userInfo.role === 'manager' || userInfo.role === 'admin');
  const isAssignedUser = pendingStep?.assigned_user_id
    ? userInfo?.id === pendingStep.assigned_user_id
    : true; // 지정 담당자가 없으면 역할만 체크
  const canApproveOrReject = isRoleAllowed && isAssignedUser;

  // DEBUG: 승인 버튼 표시 조건 확인 (문제 해결 후 제거)
  useEffect(() => {
    if (!loading && documentStatus !== 'draft') {
      console.group('[ApprovalPanel DEBUG]');
      console.log('documentStatus:', documentStatus);
      console.log('userInfo:', userInfo);
      console.log('progress:', progress);
      console.log('history:', history);
      console.log('pendingApproval:', pendingApproval);
      console.log('pendingStep:', pendingStep);
      console.log('isRoleAllowed:', isRoleAllowed);
      console.log('isAssignedUser:', isAssignedUser);
      console.log('canApproveOrReject:', canApproveOrReject);
      console.groupEnd();
    }
  }, [loading, documentStatus, userInfo, progress, history, pendingApproval, pendingStep, isRoleAllowed, isAssignedUser, canApproveOrReject]);

  const handleApprove = async () => {
    if (!pendingApproval) return;

    const ok = await confirm({
      title: '이 견적서를 승인하시겠습니까?',
      description: progress && progress.currentStep === progress.requiredSteps
        ? '최종 단계 승인입니다. 승인 후 발송 가능한 상태가 됩니다.'
        : `${progress?.currentStep ?? 1}단계 승인입니다.`,
      variant: 'info',
      confirmLabel: '승인',
      cancelLabel: '취소',
    });
    if (!ok) return;

    setProcessing(true);
    try {
      const res = await fetch(`/api/approvals/${pendingApproval.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (res.ok) {
        toast({ title: '승인 처리되었습니다', variant: 'success' });
        await fetchData();
        // Check if fully approved
        const updatedProgress = progress
          ? { ...progress, completedSteps: progress.completedSteps + 1 }
          : null;
        if (updatedProgress && updatedProgress.completedSteps >= updatedProgress.requiredSteps) {
          onStatusChange?.('approved');
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err?.error?.message || '승인 처리에 실패했습니다', variant: 'error' });
      }
    } catch {
      toast({ title: '승인 처리 중 오류가 발생했습니다', variant: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!pendingApproval) return;
    if (!rejectComment.trim()) {
      toast({ title: '반려 사유를 입력하세요', variant: 'warning' });
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/approvals/${pendingApproval.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', comment: rejectComment.trim() }),
      });

      if (res.ok) {
        toast({ title: '반려 처리되었습니다', variant: 'success' });
        await fetchData();
        onStatusChange?.('rejected');
        setShowRejectForm(false);
        setRejectComment('');
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err?.error?.message || '반려 처리에 실패했습니다', variant: 'error' });
      }
    } catch {
      toast({ title: '반려 처리 중 오류가 발생했습니다', variant: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  if (documentStatus === 'draft') return null;
  if (loading) {
    return (
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)', fontSize: 12 }}>
        <LuLoader size={14} style={{ animation: 'spin 1s linear infinite' }} /> 승인 정보 로딩 중...
      </div>
    );
  }

  const stepColors = {
    approved: { bg: '#dcfce7', border: '#86efac', text: '#15803d', icon: '#16a34a' },
    pending:  { bg: '#fef9c3', border: '#fde047', text: '#a16207', icon: '#ca8a04' },
    waiting:  { bg: '#f8fafc', border: '#e2e8f0', text: '#94a3b8', icon: '#94a3b8' },
  };

  return (
    <>
      {/* ── 승인 진행 토글 ── */}
      <button type="button" className={s.sectionToggle} onClick={() => setApprovalOpen((v) => !v)}>
        <span className={s.sectionIcon}><LuShieldCheck size={14} /></span>
        <span className={s.sectionLabel}>
          승인 현황
          {progress && (
            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
              {progress.completedSteps}/{progress.requiredSteps}
            </span>
          )}
        </span>
        <LuChevronUp size={14} className={`${s.sectionChevron} ${approvalOpen ? s.chevronOpen : ''}`} />
      </button>
      {approvalOpen && (
        <div className={s.sectionBody}>

          {/* Step-by-step vertical timeline */}
          {progress && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 14 }}>
            {(() => {
              // 마지막 승인 단계만 번복 가능
              const lastApprovedStep = [...progress.steps].reverse().find(s => s.status === 'approved')?.step ?? null;
              return progress.steps.map((step, i) => {
              const c = stepColors[step.status];
              const isLast = i === progress.steps.length - 1;
              const isPending = step.status === 'pending';
              const showActions = isPending && canApproveOrReject && pendingApproval;
              return (
                <div key={step.step} style={{ display: 'flex', gap: 10 }}>
                  {/* Timeline column */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22, flexShrink: 0 }}>
                    {/* Circle */}
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: c.bg, border: `2px solid ${c.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {step.status === 'approved' && <LuCheck size={12} style={{ color: c.icon }} />}
                      {step.status === 'pending' && <LuClock size={11} style={{ color: c.icon }} />}
                      {step.status === 'waiting' && (
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.icon }} />
                      )}
                    </div>
                    {/* Connector line */}
                    {!isLast && (
                      <div style={{
                        width: 2, flex: 1, minHeight: 12,
                        background: progress.steps[i + 1]?.status === 'approved' ? '#86efac'
                          : progress.steps[i + 1]?.status === 'pending' ? '#fde047'
                          : '#e2e8f0',
                      }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{
                    flex: 1, paddingBottom: isLast ? 0 : 10,
                    paddingTop: 1,
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 600, color: c.text,
                      lineHeight: '20px',
                    }}>
                      {step.label ?? `${step.step}단계`}
                      <span style={{
                        fontSize: 10, fontWeight: 500,
                        padding: '1px 6px', borderRadius: 3,
                        background: c.bg, color: c.text,
                        border: `1px solid ${c.border}`,
                      }}>
                        {step.status === 'approved' ? '승인' : step.status === 'pending' ? '대기 중' : '예정'}
                      </span>
                    </div>

                    {/* Approved: show timestamp + revert button */}
                    {step.status === 'approved' && (() => {
                      const h = history.find((h) => h.step === step.step && h.action === 'approve');
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          {h?.actioned_at && (
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>
                              {fmtDateTime(h.actioned_at)}
                            </span>
                          )}
                          {h && isRoleAllowed && step.step === lastApprovedStep && (
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: '승인을 번복하시겠습니까?',
                                  description: '해당 단계의 승인이 취소되고 문서가 검토 중 상태로 돌아갑니다.',
                                  variant: 'warning',
                                  confirmLabel: '번복',
                                  cancelLabel: '취소',
                                });
                                if (!ok) return;
                                setRevertingStep(step.step);
                                try {
                                  const res = await fetch(`/api/approvals/${h.id}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'revert' }),
                                  });
                                  if (res.ok) {
                                    toast({ title: '승인이 번복되었습니다', variant: 'success' });
                                    await fetchData();
                                    onStatusChange?.('in_review');
                                  } else {
                                    const err = await res.json().catch(() => ({}));
                                    toast({ title: err?.error?.message || '번복 처리에 실패했습니다', variant: 'error' });
                                  }
                                } catch {
                                  toast({ title: '번복 처리 중 오류가 발생했습니다', variant: 'error' });
                                } finally {
                                  setRevertingStep(null);
                                }
                              }}
                              disabled={revertingStep === step.step}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                fontSize: 10, color: '#64748b', background: 'none',
                                border: '1px solid #e2e8f0', borderRadius: 4,
                                padding: '1px 6px', cursor: 'pointer',
                                opacity: revertingStep === step.step ? 0.5 : 1,
                              }}
                            >
                              <LuRotateCcw size={9} />
                              {revertingStep === step.step ? '처리 중...' : '번복'}
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* Pending: inline action buttons for manager/admin */}
                    {showActions && !showRejectForm && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <ActionButton
                          label={processing ? '처리 중...' : '승인'}
                          variant="primary"
                          size="sm"
                          onClick={handleApprove}
                          disabled={processing}
                          icon={<LuCheck size={13} />}
                        />
                        <ActionButton
                          label="반려"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowRejectForm(true)}
                          disabled={processing}
                          icon={<LuX size={13} />}
                        />
                      </div>
                    )}

                    {/* Pending: reject form inline */}
                    {showActions && showRejectForm && (
                      <div style={{
                        marginTop: 8,
                        background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                        padding: 12,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <LuX size={13} />
                          반려 사유 작성
                        </div>
                        <textarea
                          className="form-input"
                          rows={3}
                          value={rejectComment}
                          onChange={(e) => setRejectComment(e.target.value)}
                          placeholder="반려 사유를 구체적으로 입력하세요. 이 내용은 요청자에게 전달됩니다."
                          style={{
                            fontSize: 12, marginBottom: 8, width: '100%', resize: 'vertical',
                            border: '1px solid #fecaca', background: '#fff',
                            borderRadius: 6, padding: '8px 10px',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <ActionButton
                            label="취소"
                            variant="ghost"
                            size="sm"
                            onClick={() => { setShowRejectForm(false); setRejectComment(''); }}
                          />
                          <ActionButton
                            label={processing ? '처리 중...' : '반려'}
                            variant="primary"
                            size="sm"
                            onClick={handleReject}
                            disabled={processing || !rejectComment.trim()}
                            icon={<LuX size={13} />}
                          />
                        </div>
                      </div>
                    )}

                    {/* Pending: member info message */}
                    {isPending && pendingApproval && !canApproveOrReject && userInfo && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, padding: '6px 8px', background: 'var(--color-surface-raised)', borderRadius: 6 }}>
                        {!isRoleAllowed
                          ? '매니저 이상만 승인/반려할 수 있습니다.'
                          : '이 단계의 지정 담당자만 승인/반려할 수 있습니다.'}
                      </div>
                    )}
                  </div>
                </div>
              );
            });
            })()}
          </div>
          )}

          {/* 디버그 진단 (문제 해결 후 제거) */}
          {documentStatus === 'in_review' && !loading && (
            <div style={{ fontSize: 10, color: '#94a3b8', padding: '8px 0', borderTop: '1px dashed #e2e8f0' }}>
              {!progress && <div style={{ color: '#ef4444' }}>⚠ progress API 응답 없음</div>}
              {progress && !progress.steps.length && <div style={{ color: '#ef4444' }}>⚠ 승인 단계 정보 없음</div>}
              {progress && progress.steps.length > 0 && !pendingStep && <div>모든 단계가 처리되었습니다</div>}
              {pendingStep && !pendingApproval && <div style={{ color: '#ef4444' }}>⚠ 대기중인 단계 exists but 승인기록에 action=null 레코드 없음 (history 길이: {history.length})</div>}
              {pendingStep && pendingApproval && !isRoleAllowed && <div>현재 역할({userInfo?.role})은 승인 권한 없음</div>}
              {pendingStep && pendingApproval && isRoleAllowed && !isAssignedUser && (
                <div>지정 담당자 불일치: 내 ID={userInfo?.id?.slice(0,8)}... / 지정={pendingStep.assigned_user_id?.slice(0,8)}...</div>
              )}
              {pendingStep && pendingApproval && canApproveOrReject && <div style={{ color: '#16a34a' }}>✓ 승인 가능 상태</div>}
            </div>
          )}

        </div>
      )}
    </>
  );
}

// ── ApprovalHistoryPanel ─────────────────────────────────

interface ApprovalHistoryPanelProps {
  documentId: string;
  documentStatus: string;
  onRevert?: () => void;
}

export function ApprovalHistoryPanel({ documentId, documentStatus, onRevert }: ApprovalHistoryPanelProps) {
  const { toast, confirm } = useFeedback();
  const [history, setHistory] = useState<ApprovalHistoryItem[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const isRoleAllowed = userInfo && (userInfo.role === 'manager' || userInfo.role === 'admin');

  useEffect(() => {
    if (documentStatus === 'draft') return;
    Promise.all([
      fetch(`/api/documents/${documentId}/approvals`),
      fetch('/api/auth/me'),
    ]).then(async ([historyRes, userRes]) => {
      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(Array.isArray(data) ? data : []);
      }
      if (userRes.ok) {
        const data = await userRes.json();
        setUserInfo({ id: data.id, role: data.role });
      }
    }).catch(() => {});
  }, [documentId, documentStatus]);

  const handleRevert = async (approvalId: string) => {
    const ok = await confirm({
      title: '승인/반려를 번복하시겠습니까?',
      description: '해당 단계의 결정이 취소되고 문서가 검토 중 상태로 돌아갑니다.',
      variant: 'warning',
      confirmLabel: '번복',
      cancelLabel: '취소',
    });
    if (!ok) return;

    setRevertingId(approvalId);
    try {
      const res = await fetch(`/api/approvals/${approvalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revert' }),
      });
      if (res.ok) {
        toast({ title: '승인이 번복되었습니다', variant: 'success' });
        // 서버에서 최신 이력 다시 가져오기
        const historyRes = await fetch(`/api/documents/${documentId}/approvals`);
        if (historyRes.ok) {
          const data = await historyRes.json();
          setHistory(Array.isArray(data) ? data : []);
        }
        onRevert?.();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err?.error?.message || '번복 처리에 실패했습니다', variant: 'error' });
      }
    } catch {
      toast({ title: '번복 처리 중 오류가 발생했습니다', variant: 'error' });
    } finally {
      setRevertingId(null);
    }
  };

  if (documentStatus === 'draft' || history.length === 0) return null;

  return (
    <>
      <button type="button" className={s.sectionToggle} onClick={() => setHistoryOpen((v) => !v)}>
        <span className={s.sectionIcon}><LuHistory size={14} /></span>
        <span className={s.sectionLabel}>
          승인 이력
          <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
            {history.length}
          </span>
        </span>
        <LuChevronUp size={14} className={`${s.sectionChevron} ${historyOpen ? s.chevronOpen : ''}`} />
      </button>
      {historyOpen && (
        <div className={s.sectionBody}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.map((h) => (
              <div key={h.id} style={{
                fontSize: 11, borderRadius: 6, padding: '8px 10px',
                background: h.action === 'reject' ? '#fef2f2'
                  : h.action === 'approve' ? '#f0fdf4'
                  : 'var(--color-surface-raised)',
                border: `1px solid ${
                  h.action === 'reject' ? '#fecaca'
                    : h.action === 'approve' ? '#bbf7d0'
                    : 'var(--color-border-light, #e5e5e5)'
                }`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: h.comment ? 4 : 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 11 }}>{h.step}단계</span>
                  <span style={{
                    fontSize: 10, fontWeight: 500, padding: '1px 5px', borderRadius: 3,
                    background: h.action === 'approve' ? '#dcfce7'
                      : h.action === 'reject' ? '#fee2e2'
                      : h.action === 'cancel' ? '#f1f5f9'
                      : '#fef9c3',
                    color: h.action === 'approve' ? '#15803d'
                      : h.action === 'reject' ? '#b91c1c'
                      : h.action === 'cancel' ? '#64748b'
                      : '#a16207',
                  }}>
                    {h.action === null && '대기 중'}
                    {h.action === 'approve' && '승인'}
                    {h.action === 'reject' && '반려'}
                    {h.action === 'cancel' && '취소'}
                  </span>
                  {h.actioned_at && (
                    <span style={{ color: '#94a3b8', marginLeft: 'auto', fontSize: 10 }}>{fmtDateTime(h.actioned_at)}</span>
                  )}
                </div>
                {h.comment && (
                  <div style={{
                    fontSize: 11, color: h.action === 'reject' ? '#991b1b' : '#64748b',
                    fontStyle: 'italic', lineHeight: 1.5,
                    paddingLeft: 2,
                  }}>
                    &ldquo;{h.comment}&rdquo;
                  </div>
                )}
                {(h.action === 'approve' || h.action === 'reject') && isRoleAllowed && (
                  <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => handleRevert(h.id)}
                      disabled={revertingId === h.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 10, color: '#64748b', background: 'none',
                        border: '1px solid #e2e8f0', borderRadius: 4,
                        padding: '2px 8px', cursor: 'pointer',
                        opacity: revertingId === h.id ? 0.5 : 1,
                      }}
                    >
                      <LuRotateCcw size={10} />
                      {revertingId === h.id ? '처리 중...' : '번복'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
