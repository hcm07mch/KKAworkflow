'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LuInfo, LuTriangleAlert, LuCircleAlert, LuCircleCheck } from 'react-icons/lu';
import s from './confirm-dialog.module.css';

// ── Types ────────────────────────────────────────────────

export type ConfirmVariant = 'info' | 'warning' | 'danger' | 'success';

export interface ConfirmInputOptions {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}

export interface ConfirmOptions {
  title: string;
  description?: string;
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Render an editable text input inside the dialog. The entered value is passed back via onConfirm. */
  input?: ConfirmInputOptions;
}

interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: (inputValue?: string) => void;
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
  input,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState<string>(input?.defaultValue ?? '');

  // Focus: input (if present) > confirm button
  useEffect(() => {
    if (input) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      confirmRef.current?.focus();
    }
  }, [input]);

  // Escape key
  const handleKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); },
    [onCancel],
  );
  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const confirmDisabled = !!input?.required && !inputValue.trim();

  const handleConfirm = () => {
    if (confirmDisabled) return;
    onConfirm(input ? inputValue : undefined);
  };

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
          {input && (
            <div className={s.inputWrap}>
              {input.label && <label className={s.inputLabel}>{input.label}</label>}
              <input
                ref={inputRef}
                type="text"
                className={s.input}
                value={inputValue}
                placeholder={input.placeholder}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !confirmDisabled) {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
              />
            </div>
          )}
        </div>

        <div className={s.actions}>
          <button type="button" className={`btn btn-md btn-secondary`} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn btn-md ${VARIANT_BTN[variant]}`}
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
