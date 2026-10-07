"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { PrimaryButton } from "@/components/ui-buttons";

export type StepDef = { id: string; title: string; description?: string };

type ReviewGroup = { step: number; title: string; rows: { label: string; value: string }[] };

/**
 * Splits a long form into numbered steps: Step 1 → Step 2 → … → Save.
 *
 * Every step stays in the DOM (only hidden), so the form still submits all
 * fields in one go and server actions work unchanged. Mark each block with
 * <Step id="..."> (or data-step="id1 id2" for something shown on several steps).
 *
 * - mode "wizard": guided, validates each step before moving on, submit on the last step.
 * - mode "sections": free navigation between sections (used by Settings); no form of its own.
 */
export function Steps({
  steps,
  mode = "wizard",
  action,
  submitLabel = "Save",
  review = false,
  children,
}: {
  steps: StepDef[];
  mode?: "wizard" | "sections";
  action?: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
  /** Show a summary of everything entered at the top of the last step. */
  review?: boolean;
  children: ReactNode;
}) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [visited, setVisited] = useState(0);
  const [summary, setSummary] = useState<ReviewGroup[]>([]);
  const last = steps.length - 1;
  const wizard = mode === "wizard";

  const panels = (index: number) =>
    Array.from(rootRef.current?.querySelectorAll<HTMLElement>(`[data-step~="${steps[index].id}"]`) ?? []);

  function validStep(index: number) {
    for (const panel of panels(index)) {
      for (const el of panel.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")) {
        if (!el.checkValidity()) {
          el.reportValidity();
          return false;
        }
      }
    }
    return true;
  }

  function go(index: number) {
    const next = Math.max(0, Math.min(last, index));
    if (wizard && next > active) {
      for (let i = active; i < next; i++) {
        if (!validStep(i)) {
          setActive(i);
          return;
        }
      }
    }
    if (wizard && review && next === last) setSummary(collectReview());
    setActive(next);
    setVisited((v) => Math.max(v, next));
    const top = rootRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function collectReview(): ReviewGroup[] {
    const groups: ReviewGroup[] = [];
    steps.slice(0, last).forEach((step, i) => {
      const rows: { label: string; value: string }[] = [];
      for (const panel of panels(i)) {
        for (const el of panel.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")) {
          if (!el.name || el.disabled || el.type === "hidden" || el.type === "radio" || el.type === "file") continue;
          let value = "";
          if (el instanceof HTMLSelectElement) value = el.value ? el.selectedOptions[0]?.text ?? "" : "";
          else if (el instanceof HTMLInputElement && el.type === "checkbox") value = el.checked ? "Yes" : "";
          else value = el.value;
          if (!value.trim()) continue;
          const labelEl = el.closest("label");
          const label =
            el.getAttribute("aria-label") ||
            labelEl?.querySelector("span")?.textContent?.replace(/\*/g, "").trim() ||
            el.getAttribute("placeholder") ||
            el.name;
          rows.push({ label, value: value.trim() });
        }
      }
      groups.push({ step: i, title: step.title, rows });
    });
    return groups;
  }

  // A submit blocked by an empty required field on a hidden step jumps to that step.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onInvalid = (e: Event) => {
      const host = (e.target as HTMLElement).closest<HTMLElement>("[data-step]");
      const ids = host?.dataset.step?.split(" ") ?? [];
      const index = steps.findIndex((s) => ids.includes(s.id));
      if (index >= 0 && !ids.includes(steps[active].id)) {
        setActive(index);
        requestAnimationFrame(() => (e.target as HTMLInputElement).reportValidity?.());
      }
    };
    root.addEventListener("invalid", onInvalid, true);
    return () => root.removeEventListener("invalid", onInvalid, true);
  }, [steps, active]);

  // Enter in a text field moves to the next step instead of submitting early.
  function onKeyDown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (!wizard || e.key !== "Enter" || active === last) return;
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    e.preventDefault();
    go(active + 1);
  }

  const hideOthers = `[data-steps="${uid}"] [data-step]:not([data-step~="${steps[active].id}"]){display:none}`;

  const body = (
    <>
      <style>{hideOthers}</style>
      {wizard && review && active === last && summary.some((g) => g.rows.length) && (
        <div className="mb-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
            <p className="text-[13px] font-semibold text-zinc-900">Check before saving</p>
          </div>
          <div className="divide-y divide-zinc-100">
            {summary
              .filter((g) => g.rows.length)
              .map((g) => (
                <div key={g.step} className="px-4 py-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {g.step + 1}. {g.title}
                    </p>
                    <button type="button" onClick={() => go(g.step)} className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
                      Edit
                    </button>
                  </div>
                  <dl className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
                    {g.rows.map((r, i) => (
                      <div key={i} className="flex min-w-0 gap-2">
                        <dt className="shrink-0 text-zinc-500">{r.label}:</dt>
                        <dd className="min-w-0 truncate font-medium text-zinc-900">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
          </div>
        </div>
      )}
      {children}
    </>
  );

  const nav = (
    <div className="mt-6 flex items-center gap-2 border-t border-zinc-200 pt-4 print:hidden">
      {active > 0 ? (
        <button
          type="button"
          onClick={() => go(active - 1)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-800 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-zinc-50"
        >
          <Icon name="arrow-left" className="h-4 w-4" />
          Back
        </button>
      ) : null}
      <span className="mx-auto text-xs text-zinc-500 tabular">
        Step {active + 1} of {steps.length}
      </span>
      {active < last ? (
        <button
          type="button"
          onClick={() => go(active + 1)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium shadow-[0_1px_2px_rgba(16,24,40,0.08)] ${
            wizard ? "bg-zinc-900 text-white hover:bg-zinc-800" : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
          }`}
        >
          <span className="sm:hidden">Next</span>
          <span className="hidden sm:inline">Next: {steps[active + 1].title}</span>
          <Icon name="arrow-right" className="h-4 w-4" />
        </button>
      ) : wizard ? (
        <PrimaryButton type="submit" icon="check">
          {submitLabel}
        </PrimaryButton>
      ) : (
        <span className="w-[4.5rem]" />
      )}
    </div>
  );

  if (!wizard) {
    return (
      <div ref={rootRef} data-steps={uid} className="grid gap-6 lg:grid-cols-[13rem_1fr] lg:gap-8">
        <nav aria-label="Sections" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <ol className="flex gap-1.5 lg:sticky lg:top-20 lg:flex-col lg:gap-px">
            {steps.map((s, i) => {
              const on = i === active;
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={on ? "step" : undefined}
                    className={`flex h-8 w-full items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 text-left text-[13px] font-medium transition-colors ${
                      on ? "bg-white text-zinc-900 shadow-[0_0_0_1px_rgb(228,228,231)] lg:shadow-none lg:bg-zinc-100" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular ${
                        on ? "bg-brand-600 text-white" : "bg-zinc-200 text-zinc-600"
                      }`}
                    >
                      {i + 1}
                    </span>
                    {s.title}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="min-w-0">
          <div className="mb-5">
            <p className="text-xs font-medium text-zinc-500 tabular">
              Step {active + 1} of {steps.length}
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-zinc-900">{steps[active].title}</h2>
            {steps[active].description && <p className="mt-1 text-[13px] text-zinc-500">{steps[active].description}</p>}
          </div>
          {body}
          {nav}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} data-steps={uid} className="scroll-mt-20">
      <div className="@container mb-6">
      <ol className="flex items-start">
        {steps.map((s, i) => {
          const done = i < active;
          const current = i === active;
          const reachable = i <= visited;
          return (
            <li key={s.id} className={`flex items-start ${i < last ? "flex-1" : ""}`}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => go(i)}
                className="group flex flex-col items-center gap-1.5 disabled:cursor-default @2xl:flex-row @2xl:gap-2"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    done
                      ? "bg-zinc-900 text-white"
                      : current
                        ? "bg-brand-600 text-white ring-4 ring-brand-100"
                        : "border border-zinc-300 bg-white text-zinc-400"
                  }`}
                >
                  {done ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span
                  className={`max-w-[5.5rem] text-center text-[11px] font-medium leading-tight @2xl:max-w-none @2xl:text-left @2xl:text-[13px] ${
                    current || done ? "text-zinc-900" : "text-zinc-400"
                  } ${reachable && !current ? "group-hover:underline" : ""}`}
                >
                  {s.title}
                </span>
              </button>
              {i < last && <span className={`mx-1.5 mt-3.5 h-px flex-1 @2xl:mx-3 ${i < active ? "bg-zinc-900" : "bg-zinc-200"}`} />}
            </li>
          );
        })}
      </ol>
      </div>

      <form action={action} onKeyDown={onKeyDown}>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-zinc-900">{steps[active].title}</h2>
            {steps[active].description && <p className="mt-1 text-[13px] text-zinc-500">{steps[active].description}</p>}
          </div>
          {body}
          {nav}
        </div>
      </form>
    </div>
  );
}

/** One step's content. For a block shown on several steps, use data-step="id1 id2" directly. */
export function Step({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  return (
    <div data-step={id} className={className}>
      {children}
    </div>
  );
}
