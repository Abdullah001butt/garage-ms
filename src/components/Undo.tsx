"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useToast } from "@/components/Toast";
import { NAV_COUNTS_REFRESH } from "@/lib/nav-events";

export const UNDO_WINDOW_MS = 6000;

/** Deletes waiting out their undo window. Kept outside React so leaving the page doesn't cancel them. */
const pending = new Map<number, () => Promise<void>>();
let seq = 0;
if (typeof window !== "undefined") {
  // Closing the tab inside the window still sends the delete (best effort).
  window.addEventListener("pagehide", () => {
    for (const [key, run] of pending) {
      pending.delete(key);
      void run();
    }
  });
}

const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/** Fades a row out and hides it; returns a function that brings it back. */
export function hideRow(row: HTMLElement | null) {
  if (!row) return () => {};
  const prev = row.style.display;
  const anim = row.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-out", fill: "forwards" });
  const t = setTimeout(() => (row.style.display = "none"), 150);
  return () => {
    clearTimeout(t);
    anim?.cancel();
    row.style.display = prev;
    row.animate?.([{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "cubic-bezier(0.22,1,0.36,1)" });
  };
}

/**
 * Gmail-style undo instead of "are you sure?" dialogs.
 * - `later`: the change only happens after the undo window (deletes).
 * - `done`: the change already happened; Undo runs its inverse (edits, payments, status moves).
 */
export function useUndo() {
  const { showToast } = useToast();
  const router = useRouter();

  const refresh = useCallback(() => {
    router.refresh();
    window.dispatchEvent(new Event(NAV_COUNTS_REFRESH));
  }, [router]);

  const later = useCallback(
    ({ message: text, commit, restore, onCommitted }: { message: string; commit: () => Promise<unknown>; restore?: () => void; onCommitted?: () => void }) => {
      const key = ++seq;
      const run = async () => {
        pending.delete(key);
        try {
          await commit();
          onCommitted?.();
          refresh();
        } catch (e) {
          restore?.();
          showToast(message(e), "error");
        }
      };
      pending.set(key, run);
      const timer = setTimeout(() => pending.get(key) && run(), UNDO_WINDOW_MS);
      showToast(text, "success", {
        duration: UNDO_WINDOW_MS,
        countdown: true,
        action: {
          label: "Undo",
          onClick: () => {
            if (!pending.has(key)) return;
            clearTimeout(timer);
            pending.delete(key);
            restore?.();
            showToast("Restored.", "info", { duration: 2000 });
          },
        },
      });
    },
    [refresh, showToast]
  );

  const done = useCallback(
    ({ message: text, undo }: { message: string; undo: () => Promise<unknown> }) => {
      refresh();
      showToast(text, "success", {
        duration: UNDO_WINDOW_MS,
        countdown: true,
        action: {
          label: "Undo",
          onClick: () => {
            undo()
              .then(() => {
                refresh();
                showToast("Undone.", "info", { duration: 2000 });
              })
              .catch((e) => showToast(message(e), "error"));
          },
        },
      });
    },
    [refresh, showToast]
  );

  return { later, done };
}
