"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionMutation } from "@/hooks/useActionMutation";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useRowMenu } from "@/components/row-menu-context";

const UNDO_WINDOW_MS = 6000;

// Splits "Delete customer "X"? This cannot be undone." into a dialog title
// and body.
function splitMessage(message: string) {
  const match = message.match(/^(.*?[?.])\s+(.*)$/);
  return match ? { title: match[1], rest: match[2] } : { title: message, rest: "" };
}

/**
 * Destructive action behind a branded confirmation dialog. When the item is
 * deleted in place (no redirect), the row disappears immediately and the
 * real delete runs after a short Undo window — nothing changes in the
 * database until that window passes.
 */
export function ConfirmSubmitButton({
  action,
  confirmMessage,
  successMessage = "Deleted.",
  redirectTo,
  confirmLabel = "Delete",
  className = "text-xs font-medium text-zinc-500 hover:text-red-600 disabled:opacity-50",
  children,
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  successMessage?: string;
  redirectTo?: string;
  confirmLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const rowMenu = useRowMenu();
  const [dialogOpen, setDialogOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pendingRef = useRef<{ timer: ReturnType<typeof setTimeout>; row: HTMLElement | null } | null>(null);
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  });

  const undoable = !redirectTo;

  const restoreRow = (row: HTMLElement | null) => {
    if (row) row.style.display = "";
  };

  const mutation = useActionMutation(action, {
    successMessage: undoable ? undefined : successMessage,
    onSuccess: () => {
      if (redirectTo) router.push(redirectTo);
    },
  });

  const commit = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    mutation.mutate(undefined, { onError: () => restoreRow(pending.row) });
  }, [mutation]);

  // Leaving the page inside the undo window still completes the delete.
  useEffect(() => {
    return () => {
      const pending = pendingRef.current;
      if (pending) {
        clearTimeout(pending.timer);
        pendingRef.current = null;
        void actionRef.current();
      }
    };
  }, []);

  function handleConfirm() {
    setDialogOpen(false);
    if (!undoable) {
      mutation.mutate();
      return;
    }
    // Inside a RowMenu the button lives in a portal, so ask the menu for its row.
    const row = rowMenu?.getAnchor() ?? buttonRef.current?.closest<HTMLElement>("[data-row], tr, li, article") ?? null;
    if (row) row.style.display = "none";
    const timer = setTimeout(commit, UNDO_WINDOW_MS);
    pendingRef.current = { timer, row };
    showToast(successMessage, "success", {
      duration: UNDO_WINDOW_MS,
      action: {
        label: "Undo",
        onClick: () => {
          const pending = pendingRef.current;
          if (!pending) return;
          clearTimeout(pending.timer);
          pendingRef.current = null;
          restoreRow(pending.row);
          showToast("Restored.", "info");
        },
      },
    });
  }

  const { title, rest } = splitMessage(confirmMessage);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={mutation.isPending}
        className={className}
        onClick={() => setDialogOpen(true)}
      >
        {mutation.isPending ? "Deleting…" : children}
      </button>
      <ConfirmDialog
        open={dialogOpen}
        title={title}
        message={undoable ? "You'll have a few seconds to undo this." : rest || "This can't be undone."}
        confirmLabel={confirmLabel}
        onConfirm={handleConfirm}
        onCancel={() => setDialogOpen(false)}
      />
    </>
  );
}
