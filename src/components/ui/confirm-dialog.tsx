'use client';

import { useCallback, useEffect, useRef } from 'react';
import { LuInfo, LuTriangleAlert, LuCircleAlert, LuCircleCheck } from 'react-icons/lu';
import s from './confirm-dialog.module.css';

// ── Types ────────────────────────────────────────────────

export type ConfirmVariant = 'info' | 'warning' | 'danger' | 'success';

export interface ConfirmOptions {
  title: string;
  description?: string;
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

// ── Icons per variant ────────────────────────────────────

const VARIANT_ICON: Record<ConfirmVariant, React.ReactNode> = {
  info:    <LuInfo size={22} />,
  warning: <LuTriangleAlert size={22} />,
  danger:  <LuCircleAlert size={22} />,
  success: <LuCircleCheck size={22} />,
};

const VARIANT_CLASS: Record<ConfirmVariant, string> = {
  info:    s.iconInfo,
  warning: s.iconWarning,
  danger:  s.iconDanger,
  success: s.iconSuccess,
};

const VARIANT_BTN: Record<ConfirmVariant, string> = {
  info:    'btn-primary',
  warning: 'btn-primary',
  danger:  'btn-danger',
  success: 'btn-primary',
};

// ── Component ────────────────────────────────────────────

export function ConfirmDialog({
  title,
  description,
  variant = 'info',
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus confirm button on mount
  useEffect(() => { confirmRef.current?.focus(); }, []);

  // Escape key
  const handleKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); },
    [onCancel],
  );
  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <div className={s.overlay} onClick={onCancel}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={s.iconArea}>
          <div className={`${s.iconCircle} ${VARIANT_CLASS[variant]}`}>
            {VARIANT_ICON[variant]}
          </div>
        </div>

        <div className={s.body}>
          <p className={s.title}>{title}</p>
          {description && <p className={s.description}>{description}</p>}
        </div>

        <div className={s.actions}>
          <button type="button" className={`btn btn-md btn-secondary`} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn btn-md ${VARIANT_BTN[variant]}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
