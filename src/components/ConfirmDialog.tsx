"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";

// Branded replacement for the browser's confirm() box.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center print:hidden">
      <div className="absolute inset-0 bg-zinc-950/40" onClick={onCancel} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="pop-in relative w-full max-w-md rounded-lg bg-white p-5 shadow-2xl ring-1 ring-zinc-200"
      >
        <div className="flex gap-4">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              tone === "danger" ? "bg-red-50 text-red-600" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            <Icon name={tone === "danger" ? "trash" : "help"} className="h-5 w-5" />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id="confirm-title" className="text-base font-semibold text-zinc-900">
              {title}
            </h2>
            {message && <p className="mt-1.5 text-sm text-zinc-600">{message}</p>}
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex h-9 items-center justify-center rounded-md px-3.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 ${
              tone === "danger"
                ? "bg-red-600 hover:bg-red-700 focus-visible:outline-red-600"
                : "bg-zinc-900 hover:bg-zinc-800 focus-visible:outline-zinc-900"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
