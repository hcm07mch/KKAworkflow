'use client';

/**
 * FeedbackProvider — 전역 Confirm Dialog + Toast 관리
 *
 * 사용법:
 *   const { confirm, toast } = useFeedback();
 *
 *   // Confirm (Promise-based)
 *   const ok = await confirm({ title: '정말 삭제하시겠습니까?', variant: 'danger' });
 *   if (!ok) return;
 *
 *   // Toast
 *   toast({ title: '저장되었습니다', variant: 'success' });
 */

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { ConfirmDialog, type ConfirmOptions } from './confirm-dialog';
import { ToastContainer, useToastState, type ToastOptions } from './toast';

// ── Context ──────────────────────────────────────────────

interface FeedbackContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toast: (options: ToastOptions) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────

export function FeedbackProvider({ children }: { children: ReactNode }) {
  // ── Confirm state ──
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    confirmState?.resolve(true);
    setConfirmState(null);
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    confirmState?.resolve(false);
    setConfirmState(null);
  }, [confirmState]);

  // ── Toast state ──
  const { toasts, toast, dismiss } = useToastState();

  return (
    <FeedbackContext.Provider value={{ confirm, toast }}>
      {children}

      {/* Confirm Dialog */}
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          description={confirmState.description}
          variant={confirmState.variant}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </FeedbackContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error('useFeedback must be used within <FeedbackProvider>');
  }
  return ctx;
}
