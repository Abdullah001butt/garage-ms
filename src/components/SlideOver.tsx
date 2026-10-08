"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

// A right-hand side panel that holds a form behind a button, instead of
// leaving "Add ..." forms permanently open under every list. The panel stays
// mounted while closed so a submitted server-action form can finish and
// reset normally; it closes itself as soon as its form is submitted.
export function SlideOver({
  title,
  description,
  triggerLabel,
  triggerIcon = "plus",
  variant = "primary",
  defaultOpen = false,
  id,
  hideTrigger = false,
  children,
}: {
  title: string;
  description?: string;
  triggerLabel: string;
  triggerIcon?: IconName;
  variant?: "primary" | "secondary";
  defaultOpen?: boolean;
  /** Lets other controls (e.g. a row's "⋯ → Edit") open this panel via openSlideOver(id). */
  id?: string;
  hideTrigger?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!id) return;
    const onOpen = (e: Event) => (e as CustomEvent<string>).detail === id && setOpen(true);
    window.addEventListener("slideover:open", onOpen);
    return () => window.removeEventListener("slideover:open", onOpen);
  }, [id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const triggerClass =
    variant === "primary"
      ? "bg-brand-600 text-white shadow-[0_1px_2px_rgba(16,24,40,0.08)] hover:bg-brand-700"
      : "border border-zinc-300 bg-white text-zinc-800 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-zinc-50";

  return (
    <>
      {!hideTrigger && (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3.5 text-sm font-medium transition-colors print:hidden ${triggerClass}`}
      >
        <Icon name={triggerIcon} className="h-4 w-4 -ml-0.5" />
        {triggerLabel}
      </button>
      )}

      <div
        className={`fixed inset-0 z-50 overflow-hidden print:hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
        inert={!open}
      >
        <div
          className={`absolute inset-0 bg-zinc-950/30 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
          onClick={() => setOpen(false)}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white transition-transform duration-200 ease-out ${
            open ? "translate-x-0 shadow-2xl" : "translate-x-full shadow-none"
          }`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-zinc-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close panel"
              className="-mr-1 flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
          <div
            className="flex-1 overflow-y-auto px-5 py-5"
            onSubmit={() => setTimeout(() => setOpen(false), 0)}
          >
            {children}
          </div>
        </aside>
      </div>
    </>
  );
}

export function openSlideOver(id: string) {
  window.dispatchEvent(new CustomEvent("slideover:open", { detail: id }));
}
