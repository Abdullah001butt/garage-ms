"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRowMenu } from "@/components/row-menu-context";
import { hideRow, useUndo } from "@/components/Undo";

/**
 * Delete button without an "are you sure?" dialog: the item disappears at once and the real delete
 * runs after a short Undo window (toast, or Ctrl+Z). Nothing changes in the database until then.
 * With `redirectTo` (deleting the page you are on) the page dims during the window, then navigates.
 */
export function ConfirmSubmitButton({
  action,
  successMessage = "Deleted.",
  redirectTo,
  className = "text-xs font-medium text-zinc-500 hover:text-red-600 disabled:opacity-50",
  children,
}: {
  action: () => Promise<void>;
  /** Kept for existing callers; deletes no longer ask for confirmation. */
  confirmMessage?: string;
  successMessage?: string;
  redirectTo?: string;
  confirmLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const rowMenu = useRowMenu();
  const { later } = useUndo();
  const [waiting, setWaiting] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function handleClick() {
    if (waiting) return;
    if (redirectTo) {
      const main = document.querySelector("main");
      main?.classList.add("deleting");
      setWaiting(true);
      later({
        message: successMessage,
        commit: action,
        restore: () => {
          main?.classList.remove("deleting");
          setWaiting(false);
        },
        onCommitted: () => {
          main?.classList.remove("deleting");
          router.push(redirectTo);
        },
      });
      return;
    }
    // Inside a RowMenu the button lives in a portal, so ask the menu for its row.
    const row = rowMenu?.getAnchor() ?? buttonRef.current?.closest<HTMLElement>("[data-row], tr, li, article") ?? null;
    later({ message: successMessage, commit: action, restore: hideRow(row) });
  }

  return (
    <button ref={buttonRef} type="button" disabled={waiting} className={className} onClick={handleClick}>
      {children}
    </button>
  );
}
