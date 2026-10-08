"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useToast } from "@/components/Toast";
import { useUndo } from "@/components/Undo";
import type { InlineResult } from "@/app/inline-actions";

type Option = { value: string; label: string };

/**
 * Click a value in a table to change it on the spot. Enter or clicking away saves, Esc cancels.
 * `action` is a server action already bound to the row (and field); it receives the raw text.
 */
export function InlineEdit({
  value,
  display,
  action,
  kind = "text",
  options,
  label,
  align = "left",
  prefix,
  className = "",
  inputClassName = "",
  disabled = false,
}: {
  value: string;
  display?: ReactNode;
  action: (raw: string) => Promise<InlineResult>;
  kind?: "text" | "number" | "select";
  options?: Option[];
  label: string;
  align?: "left" | "right";
  prefix?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // The value we just saved, shown until the server sends the fresh one (then `from` no longer matches).
  const [opt, setOpt] = useState<{ from: string; to: string } | null>(null);
  const optimistic = opt && opt.from === value ? opt.to : null;
  const [flash, setFlash] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const { done } = useUndo();

  useEffect(() => {
    if (editing && kind !== "select") inputRef.current?.select();
  }, [editing, kind]);

  function save(next: string) {
    setEditing(false);
    if (next.trim() === value.trim()) return;
    setOpt({ from: value, to: next });
    startTransition(async () => {
      const res = await action(next);
      if (!res.ok) {
        setOpt(null);
        showToast(res.error, "error");
        return;
      }
      setFlash(true);
      setTimeout(() => setFlash(false), 900);
      const label_ = (v: string) => (kind === "select" ? (options?.find((o) => o.value === v)?.label ?? (v || "—")) : v || "—");
      const before = value;
      done({
        message: `${label}: ${label_(before)} → ${label_(next)}`,
        undo: async () => {
          const r = await action(before);
          if (!r.ok) throw new Error(r.error);
        },
      });
    });
  }

  const right = align === "right";
  if (editing && !disabled) {
    if (kind === "select") {
      return (
        <select
          autoFocus
          aria-label={label}
          defaultValue={value}
          onChange={(e) => save(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          className={`h-8 rounded-md border border-zinc-300 bg-white px-2 text-[13px] shadow-sm outline-none ring-2 ring-zinc-900/10 focus:border-zinc-500 ${inputClassName}`}
        >
          {options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 ${right ? "justify-end" : ""}`}>
        {prefix && <span className="text-xs text-zinc-400">{prefix}</span>}
        <input
          ref={inputRef}
          aria-label={label}
          value={draft}
          inputMode={kind === "number" ? "decimal" : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => save(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save(draft);
            } else if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          className={`h-8 min-w-0 rounded-md border border-zinc-300 bg-white px-2 text-[13px] tabular shadow-sm outline-none ring-2 ring-zinc-900/10 focus:border-zinc-500 ${
            kind === "number" ? "w-24" : "w-full min-w-40"
          } ${right ? "text-right" : ""} ${inputClassName}`}
        />
      </span>
    );
  }

  const shown =
    optimistic !== null ? (kind === "select" ? (options?.find((o) => o.value === optimistic)?.label ?? optimistic) : `${prefix ? `${prefix} ` : ""}${optimistic}`) : (display ?? value);

  if (disabled) return <span className={className}>{shown}</span>;

  return (
    <button
      type="button"
      title={`Click to edit ${label.toLowerCase()}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
      className={`group/ie relative -mx-1.5 inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-zinc-100 hover:ring-1 hover:ring-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
        right ? "flex-row-reverse text-right" : ""
      } ${flash ? "bg-emerald-50 ring-1 ring-emerald-200" : ""} ${pending ? "opacity-60" : ""} ${className}`}
    >
      <span className={kind === "text" ? "min-w-0 truncate" : "whitespace-nowrap"}>{shown}</span>
      {pending ? (
        <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-[1.5px] border-zinc-300 border-t-zinc-700" aria-hidden="true" />
      ) : flash ? (
        <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
          <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover/ie:opacity-100 [@media(hover:none)]:hidden" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
