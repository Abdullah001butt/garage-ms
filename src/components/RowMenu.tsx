"use client";

import Link from "next/link";
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "@/components/icons";
import { useActionMutation } from "@/hooks/useActionMutation";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { RowMenuContext } from "@/components/row-menu-context";
import { openSlideOver } from "@/components/SlideOver";

const ITEM =
  "flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-left text-[13px] text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50";

/**
 * "⋯" actions menu for a table row. The panel is portalled to <body> so it is
 * never clipped by scrolling tables, and stays mounted while closed so a
 * Delete's confirmation dialog and Undo window survive the menu closing.
 */
export function RowMenu({ children, label = "Actions" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const place = useCallback(() => {
    const t = triggerRef.current?.getBoundingClientRect();
    if (!t) return;
    const width = 208;
    const panelHeight = panelRef.current?.offsetHeight ?? 160;
    const below = t.bottom + 4 + panelHeight < window.innerHeight;
    setPos({
      top: below ? t.bottom + 4 : Math.max(8, t.top - 4 - panelHeight),
      left: Math.min(Math.max(8, t.right - width), window.innerWidth - width - 8),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const getAnchor = useCallback(
    () => triggerRef.current?.closest<HTMLElement>("[data-row], tr, li, article") ?? null,
    []
  );

  return (
    <RowMenuContext.Provider value={{ close, getAnchor }}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setMounted(true);
          setOpen((o) => !o);
        }}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 print:hidden ${
          open ? "bg-zinc-100 text-zinc-700" : ""
        }`}
      >
        <Icon name="more" className="h-4 w-4" />
      </button>
      {mounted &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{ top: pos.top, left: pos.left }}
            className={`fixed z-[80] w-52 rounded-lg border border-zinc-200 bg-white p-1 shadow-[0_10px_30px_rgba(16,24,40,0.14)] ${
              open ? "pop-in" : "hidden"
            }`}
          >
            {children}
          </div>,
          document.body
        )}
    </RowMenuContext.Provider>
  );
}

export function RowMenuLink({ href, icon, children }: { href: string; icon?: IconName; children: ReactNode }) {
  const ctx = useContext(RowMenuContext);
  return (
    <Link href={href} role="menuitem" onClick={() => ctx?.close()} className={ITEM}>
      {icon && <Icon name={icon} className="h-4 w-4 text-zinc-400" />}
      {children}
    </Link>
  );
}

export function RowMenuButton({ onClick, icon, children }: { onClick: () => void; icon?: IconName; children: ReactNode }) {
  const ctx = useContext(RowMenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        ctx?.close();
        onClick();
      }}
      className={ITEM}
    >
      {icon && <Icon name={icon} className="h-4 w-4 text-zinc-400" />}
      {children}
    </button>
  );
}

/** Runs a server action from the menu, with a toast on success. */
export function RowMenuAction({
  action,
  icon,
  successMessage,
  children,
}: {
  action: () => Promise<void>;
  icon?: IconName;
  successMessage?: string;
  children: ReactNode;
}) {
  const ctx = useContext(RowMenuContext);
  const mutation = useActionMutation(action, { successMessage });
  return (
    <button
      type="button"
      role="menuitem"
      disabled={mutation.isPending}
      onClick={() => {
        ctx?.close();
        mutation.mutate();
      }}
      className={ITEM}
    >
      {icon && <Icon name={icon} className="h-4 w-4 text-zinc-400" />}
      {children}
    </button>
  );
}

/** Opens a SlideOver (rendered elsewhere with the same id) — usable from server pages. */
export function RowMenuOpenPanel({ panelId, icon, children }: { panelId: string; icon?: IconName; children: ReactNode }) {
  const ctx = useContext(RowMenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        ctx?.close();
        openSlideOver(panelId);
      }}
      className={ITEM}
    >
      {icon && <Icon name={icon} className="h-4 w-4 text-zinc-400" />}
      {children}
    </button>
  );
}

export function RowMenuSeparator() {
  return <div className="my-1 h-px bg-zinc-100" role="separator" />;
}

/** Destructive item: confirmation dialog + Undo window (see ConfirmSubmitButton). */
export function RowMenuDelete({
  action,
  confirmMessage,
  successMessage,
  label = "Delete",
  redirectTo,
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  successMessage?: string;
  label?: string;
  /** Navigate away after deleting (no Undo window in that case). */
  redirectTo?: string;
}) {
  const ctx = useContext(RowMenuContext);
  return (
    <div onClick={() => ctx?.close()}>
      <ConfirmSubmitButton
        action={action}
        confirmMessage={confirmMessage}
        successMessage={successMessage}
        confirmLabel={label}
        redirectTo={redirectTo}
        className="flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-left text-[13px] text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        <Icon name="trash" className="h-4 w-4" />
        {label}
      </ConfirmSubmitButton>
    </div>
  );
}
