'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { LuX, LuCircleCheck, LuCircleAlert, LuTriangleAlert, LuInfo } from 'react-icons/lu';
import s from './toast.module.css';

// ── Types ────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title: string;
  message?: string;
  variant?: ToastVariant;
  duration?: number; // ms, default 4000
}

interface ToastItem extends ToastOptions {
  id: number;
  exiting?: boolean;
}

// ── Icons per variant ────────────────────────────────────

const VARIANT_ICON: Record<ToastVariant, React.ReactNode> = {
  success: <LuCircleCheck size={18} />,
  error:   <LuCircleAlert size={18} />,
  warning: <LuTriangleAlert size={18} />,
  info:    <LuInfo size={18} />,
};

const ICON_CLASS: Record<ToastVariant, string> = {
  success: s.iconSuccess,
  error:   s.iconError,
  warning: s.iconWarning,
  info:    s.iconInfo,
};

const ACCENT_CLASS: Record<ToastVariant, string> = {
  success: s.accentSuccess,
  error:   s.accentError,
  warning: s.accentWarning,
  info:    s.accentInfo,
};

// ── Component ────────────────────────────────────────────

export function ToastContainer({ toasts, onDismiss }: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className={s.container}>
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const variant = toast.variant ?? 'info';
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const dur = toast.duration ?? 4000;
    timerRef.current = setTimeout(() => onDismiss(toast.id), dur);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div className={`${s.toast} ${ACCENT_CLASS[variant]} ${toast.exiting ? s.exiting : ''}`}>
      <span className={`${s.icon} ${ICON_CLASS[variant]}`}>
        {VARIANT_ICON[variant]}
      </span>
      <div className={s.content}>
        <div className={s.title}>{toast.title}</div>
        {toast.message && <div className={s.message}>{toast.message}</div>}
      </div>
      <button type="button" className={s.close} onClick={() => onDismiss(toast.id)}>
        <LuX size={14} />
      </button>
    </div>
  );
}

// ── Hook (standalone usage) ──────────────────────────────

let nextId = 0;

export function useToastState() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((options: ToastOptions) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { ...options, id }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200); // match exit animation duration
  }, []);

  return { toasts, toast, dismiss };
}
