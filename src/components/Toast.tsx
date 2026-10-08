"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";

type ToastKind = "success" | "error" | "info";
type ToastAction = { label: string; onClick: () => void };
type ToastOptions = { action?: ToastAction; duration?: number; countdown?: boolean };
type ToastItem = { id: number; message: string; kind: ToastKind; action?: ToastAction; duration: number; countdown?: boolean };

const ToastContext = createContext<{
  showToast: (message: string, kind?: ToastKind, options?: ToastOptions) => number;
  dismissToast: (id: number) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const KIND_ICON = {
  success: { name: "check-circle", className: "text-emerald-400" },
  error: { name: "alert", className: "text-red-400" },
  info: { name: "info", className: "text-zinc-400" },
} as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = "success", options?: ToastOptions) => {
      const id = ++idRef.current;
      const duration = options?.duration ?? 3500;
      setToasts((t) => [...t.slice(-2), { id, message, kind, action: options?.action, duration, countdown: options?.countdown }]);
      setTimeout(() => dismissToast(id), duration);
      return id;
    },
    [dismissToast]
  );

  // Ctrl+Z (⌘Z) runs the newest toast's Undo, like Gmail — but never while typing in a field.
  const latestUndo = useRef<ToastItem | null>(null);
  useEffect(() => {
    latestUndo.current = [...toasts].reverse().find((t) => t.action?.label === "Undo") ?? null;
  }, [toasts]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== "z") return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable='true']")) return;
      const t = latestUndo.current;
      if (!t?.action) return;
      e.preventDefault();
      t.action.onClick();
      dismissToast(t.id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-4 sm:translate-x-0 print:hidden"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const icon = KIND_ICON[toast.kind];
          return (
            <div
              key={toast.id}
              className="toast-in pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-lg bg-zinc-900 px-3.5 py-3 text-sm text-white shadow-[0_8px_30px_rgba(0,0,0,0.25)] ring-1 ring-white/10"
            >
              {toast.countdown && <span className="toast-countdown absolute inset-x-0 bottom-0 h-0.5 origin-left bg-white/45" style={{ animationDuration: `${toast.duration}ms` }} />}
              <Icon name={icon.name} className={`h-4 w-4 ${icon.className}`} />
              <span className="min-w-0 flex-1">{toast.message}</span>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    dismissToast(toast.id);
                  }}
                  className="shrink-0 rounded px-1.5 py-0.5 text-[13px] font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
                >
                  {toast.action.label}
                  {toast.action.label === "Undo" && <kbd className="ml-1.5 hidden rounded border border-white/20 px-1 font-sans text-[10px] font-medium text-zinc-400 no-underline sm:inline">Ctrl Z</kbd>}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss"
                className="-mr-1 shrink-0 rounded p-0.5 text-zinc-500 hover:text-zinc-200"
              >
                <Icon name="x" className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
