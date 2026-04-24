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
import { ConfirmDialog, type ConfirmOptions, type ConfirmInputOptions } from './confirm-dialog';
import { ToastContainer, useToastState, type ToastOptions } from './toast';

// ── Context ──────────────────────────────────────────────

export interface PromptOptions extends Omit<ConfirmOptions, 'input'> {
  input: ConfirmInputOptions;
}

interface FeedbackContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Ask for a text value via the confirm dialog. Resolves with the entered string on confirm, or null on cancel. */
  prompt: (options: PromptOptions) => Promise<string | null>;
  toast: (options: ToastOptions) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────

export function FeedbackProvider({ children }: { children: ReactNode }) {
  // ── Confirm state ──
  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { resolve: (v: boolean | string | null) => void; returnsString: boolean }) | null
  >(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        ...options,
        returnsString: false,
        resolve: (v) => resolve(v === true),
      });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      setConfirmState({
        ...options,
        returnsString: true,
        resolve: (v) => resolve(typeof v === 'string' ? v : null),
      });
    });
  }, []);

  const handleConfirm = useCallback(
    (inputValue?: string) => {
      if (!confirmState) return;
      if (confirmState.returnsString) {
        confirmState.resolve(inputValue ?? '');
      } else {
        confirmState.resolve(true);
      }
      setConfirmState(null);
    },
    [confirmState],
  );

  const handleCancel = useCallback(() => {
    if (!confirmState) return;
    if (confirmState.returnsString) {
      confirmState.resolve(null);
    } else {
      confirmState.resolve(false);
    }
    setConfirmState(null);
  }, [confirmState]);

  // ── Toast state ──
  const { toasts, toast, dismiss } = useToastState();

  return (
    <FeedbackContext.Provider value={{ confirm, prompt, toast }}>
      {children}

      {/* Confirm Dialog */}
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          description={confirmState.description}
          variant={confirmState.variant}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          input={confirmState.input}
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
