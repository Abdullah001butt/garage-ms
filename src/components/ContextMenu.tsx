"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "@/components/icons";
import { openPeek } from "@/components/Peek";
import { useToast } from "@/components/Toast";
import { hideRow, useUndo } from "@/components/Undo";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { updateJobInline } from "@/app/inline-actions";
import { duplicateAsEstimate, duplicateJob, recordFullPayment, removeEstimate } from "@/app/context-actions";
import { deleteJobCard } from "@/app/jobs/actions";
import { createInvoiceFromJobCard, deletePayment } from "@/app/invoices/actions";
import { deleteCustomer } from "@/app/customers/actions";
import { deletePart } from "@/app/inventory/actions";
import type { CtxData } from "@/lib/ctx";

type Item =
  | { kind: "sep" }
  | { kind: "item"; label: string; icon: IconName; run: () => void; hint?: string; danger?: boolean; accent?: boolean };

const aed = (n: number) => `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const TIP_KEY = "albahir-ctx-tip";

/** One menu for the whole app: right-click (or long-press) any row marked with data-ctx. */
export function ContextMenuHost() {
  const router = useRouter();
  const { showToast } = useToast();
  const { later, done } = useUndo();
  const [, startTransition] = useTransition();
  const [menu, setMenu] = useState<{ x: number; y: number; data: CtxData; row: HTMLElement } | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [active, setActive] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setMenu(null), []);

  // Open on right-click. Shift + right-click (or right-click inside a text field / on selected text) keeps the browser's own menu.
  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const row = target.closest<HTMLElement>("[data-ctx]");
      if (!row || e.shiftKey || target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (window.getSelection()?.toString()) return;
      let data: CtxData;
      try {
        data = JSON.parse(row.dataset.ctx!);
      } catch {
        return;
      }
      e.preventDefault();
      setActive(0);
      setMenu({ x: e.clientX, y: e.clientY, data, row });
    };
    document.addEventListener("contextmenu", onCtx);
    return () => document.removeEventListener("contextmenu", onCtx);
  }, []);

  // A one-time tip the first time a page with right-clickable rows opens.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (localStorage.getItem(TIP_KEY) || !document.querySelector("[data-ctx]") || window.matchMedia("(hover: none)").matches) return;
        localStorage.setItem(TIP_KEY, "1");
        showToast("Tip: right-click any row for quick actions.", "info", { duration: 5000 });
      } catch {}
    }, 1500);
    return () => clearTimeout(t);
  });

  // Highlight the row the menu belongs to.
  useEffect(() => {
    if (!menu) return;
    menu.row.setAttribute("data-ctx-open", "");
    return () => menu.row.removeAttribute("data-ctx-open");
  }, [menu]);

  useLayoutEffect(() => {
    if (!menu || !panelRef.current) return;
    const { offsetWidth: w, offsetHeight: h } = panelRef.current;
    setPos({
      left: Math.max(8, Math.min(menu.x, window.innerWidth - w - 8)),
      top: menu.y + h + 8 > window.innerHeight ? Math.max(8, menu.y - h) : menu.y,
    });
    panelRef.current.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => !panelRef.current?.contains(e.target as Node) && close();
    const onScroll = () => close();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    window.addEventListener("blur", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("blur", onScroll);
    };
  }, [menu, close]);

  if (!menu) return null;
  const { data, row } = menu;

  const go = (href: string) => router.push(href);
  const copy = (text: string, what: string) =>
    navigator.clipboard?.writeText(text).then(
      () => showToast(`${what} copied.`, "success", { duration: 1800 }),
      () => showToast("Couldn’t copy.", "error")
    );
  const whatsapp = (phone: string, text: string) => window.open(buildWhatsAppLink(phone, text), "_blank", "noopener");
  const call = (phone: string) => (window.location.href = `tel:${phone.replace(/[^\d+]/g, "")}`);
  const quietly = (fn: () => Promise<void>) => startTransition(fn);

  const items: Item[] = [];
  let title = "";
  let subtitle = "";

  if (data.t === "job") {
    title = data.plate ?? "Job card";
    subtitle = [data.title, data.customer].filter(Boolean).join(" · ");
    const setStatus = (to: "pending" | "in_progress" | "completed", label: string) =>
      quietly(async () => {
        const from = data.status;
        const r = await updateJobInline(data.id, "status", to);
        if (!r.ok) return void showToast(r.error, "error");
        done({
          message: `${data.plate ?? "Job"} → ${label}`,
          undo: async () => {
            const x = await updateJobInline(data.id, "status", from);
            if (!x.ok) throw new Error(x.error);
          },
        });
      });
    items.push(
      { kind: "item", label: "Open job card", icon: "arrow-right", hint: "↵", run: () => go(`/jobs/${data.id}`) },
      { kind: "item", label: "Quick view", icon: "eye", run: () => openPeek("job", data.id) },
      { kind: "sep" }
    );
    if (data.status === "pending") items.push({ kind: "item", label: "Start job", icon: "play", accent: true, run: () => setStatus("in_progress", "In progress") });
    if (data.status === "in_progress") {
      items.push({ kind: "item", label: "Mark as done", icon: "check", accent: true, run: () => setStatus("completed", "Completed") });
      items.push({ kind: "item", label: "Move back to pending", icon: "rotate-ccw", run: () => setStatus("pending", "Pending") });
    }
    if (data.status === "completed") {
      if (!data.invoiced && data.customerId)
        items.push({
          kind: "item",
          label: "Create invoice",
          icon: "receipt",
          accent: true,
          run: () => quietly(async () => void (await createInvoiceFromJobCard(data.id, data.customerId!))),
        });
      items.push({ kind: "item", label: "Move back to in progress", icon: "rotate-ccw", run: () => setStatus("in_progress", "In progress") });
    }
    items.push({
      kind: "item",
      label: "Book again",
      icon: "plus",
      run: () =>
        quietly(async () => {
          const r = await duplicateJob(data.id);
          if (!r.ok) return void showToast(r.error, "error");
          done({ message: `New pending job for ${data.plate ?? "this car"}.`, undo: () => deleteJobCard(r.id) });
        }),
    });
    items.push({ kind: "sep" });
    if (data.phone) {
      items.push({ kind: "item", label: "WhatsApp customer", icon: "message", run: () => whatsapp(data.phone!, `Hi ${data.customer ?? ""}, this is Al Bahir Garage about your car ${data.plate ?? ""}. `) });
      items.push({ kind: "item", label: "Call customer", icon: "phone", run: () => call(data.phone!) });
    }
    if (data.plate) items.push({ kind: "item", label: "Copy plate number", icon: "copy", run: () => copy(data.plate!, "Plate number") });
    items.push(
      { kind: "sep" },
      { kind: "item", label: "Delete job card", icon: "trash", danger: true, run: () => later({ message: "Job card deleted.", commit: () => deleteJobCard(data.id), restore: hideRow(row) }) }
    );
  }

  if (data.t === "invoice") {
    const isEst = data.doc === "estimate";
    const base = isEst ? "/estimates" : "/invoices";
    title = data.number;
    subtitle = [data.customer, !isEst && data.balance ? `${aed(data.balance)} due` : null].filter(Boolean).join(" · ");
    const pay = (method: "cash" | "card") =>
      quietly(async () => {
        const r = await recordFullPayment(data.id, method);
        if (!r.ok) return void showToast(r.error, "error");
        done({ message: `${aed(r.amount)} ${method} payment recorded on ${data.number}.`, undo: () => deletePayment(data.id, r.paymentId) });
      });
    items.push(
      { kind: "item", label: isEst ? "Open estimate" : "Open invoice", icon: "arrow-right", hint: "↵", run: () => go(`${base}/${data.id}`) },
      { kind: "item", label: "Quick view", icon: "eye", run: () => openPeek("invoice", data.id) },
      { kind: "item", label: "Print", icon: "printer", run: () => window.open(`${base}/${data.id}?print=1`, "_blank") },
      { kind: "sep" }
    );
    if (!isEst && (data.balance ?? 0) > 0.01) {
      items.push({ kind: "item", label: `Mark paid · Cash`, icon: "wallet", accent: true, run: () => pay("cash") });
      items.push({ kind: "item", label: `Mark paid · Card`, icon: "wallet", run: () => pay("card") });
      if (data.phone)
        items.push({
          kind: "item",
          label: "Send payment reminder",
          icon: "message",
          run: () => whatsapp(data.phone!, `Hi ${data.customer ?? ""}, a friendly reminder from Al Bahir Garage: invoice ${data.number} has ${aed(data.balance!)} outstanding. Thank you!`),
        });
      items.push({ kind: "sep" });
    } else if (data.phone) {
      items.push({ kind: "item", label: "WhatsApp customer", icon: "message", run: () => whatsapp(data.phone!, `Hi ${data.customer ?? ""}, this is Al Bahir Garage regarding ${data.number}. `) }, { kind: "sep" });
    }
    items.push(
      {
        kind: "item",
        label: "Duplicate as estimate",
        icon: "copy",
        run: () =>
          quietly(async () => {
            const r = await duplicateAsEstimate(data.id);
            if (!r.ok) return void showToast(r.error, "error");
            done({
              message: "Copied to a new estimate.",
              undo: async () => {
                const x = await removeEstimate(r.id);
                if (!x.ok) throw new Error(x.error);
              },
            });
          }),
      },
      { kind: "item", label: `Copy ${isEst ? "estimate" : "invoice"} number`, icon: "copy", run: () => copy(data.number, "Number") }
    );
  }

  if (data.t === "customer") {
    title = data.name;
    subtitle = data.phone ?? "";
    items.push(
      { kind: "item", label: "Open customer", icon: "arrow-right", hint: "↵", run: () => go(`/customers/${data.id}`) },
      { kind: "item", label: "Quick view", icon: "eye", run: () => openPeek("customer", data.id) },
      { kind: "item", label: "Statement of account", icon: "file", run: () => go(`/customers/${data.id}/statement`) },
      { kind: "item", label: "New job card", icon: "wrench", run: () => go("/jobs/new") },
      { kind: "sep" }
    );
    if (data.phone) {
      items.push(
        { kind: "item", label: "WhatsApp", icon: "message", run: () => whatsapp(data.phone!, `Hi ${data.name}, this is Al Bahir Garage. `) },
        { kind: "item", label: "Call", icon: "phone", run: () => call(data.phone!) },
        { kind: "item", label: "Copy phone number", icon: "copy", run: () => copy(data.phone!, "Phone number") },
        { kind: "sep" }
      );
    }
    items.push({ kind: "item", label: "Delete customer", icon: "trash", danger: true, run: () => later({ message: `${data.name} deleted.`, commit: () => deleteCustomer(data.id), restore: hideRow(row) }) });
  }

  if (data.t === "part") {
    title = data.name;
    subtitle = data.sku ?? "";
    items.push(
      { kind: "item", label: "Stock history", icon: "clock", hint: "↵", run: () => go(`/inventory/${data.id}`) },
      { kind: "item", label: "Copy part name", icon: "copy", run: () => copy(data.name, "Part name") }
    );
    if (data.sku) items.push({ kind: "item", label: "Copy SKU", icon: "copy", run: () => copy(data.sku!, "SKU") });
    items.push({ kind: "sep" }, { kind: "item", label: "Delete part", icon: "trash", danger: true, run: () => later({ message: `${data.name} deleted.`, commit: () => deletePart(data.id), restore: hideRow(row) }) });
  }

  const actionable = items.filter((i): i is Extract<Item, { kind: "item" }> => i.kind === "item");
  const runAt = (i: number) => {
    const it = actionable[i];
    if (!it) return;
    close();
    it.run();
  };

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      tabIndex={-1}
      aria-label={`${title} actions`}
      style={{ top: pos.top, left: pos.left }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
        else if (e.key === "ArrowDown") {
          e.preventDefault();
          setActive((a) => (a + 1) % actionable.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActive((a) => (a - 1 + actionable.length) % actionable.length);
        } else if (e.key === "Enter") {
          e.preventDefault();
          runAt(active);
        }
      }}
      className="ctx-in fixed z-[90] w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white/95 p-1 shadow-[0_16px_40px_rgba(16,24,40,0.18)] outline-none backdrop-blur print:hidden"
    >
      <div className="px-2.5 pb-1.5 pt-2">
        <p className={`truncate text-[13px] font-semibold text-zinc-900 ${data.t === "invoice" ? "font-mono" : ""}`}>{title}</p>
        {subtitle && <p className="truncate text-[11px] text-zinc-500">{subtitle}</p>}
      </div>
      <div className="my-1 h-px bg-zinc-100" />
      {items.map((it, k) => {
        if (it.kind === "sep") return k === 0 || items[k - 1]?.kind === "sep" || k === items.length - 1 ? null : <div key={k} className="my-1 h-px bg-zinc-100" role="separator" />;
        const idx = actionable.indexOf(it);
        const on = idx === active;
        return (
          <button
            key={k}
            type="button"
            role="menuitem"
            onMouseEnter={() => setActive(idx)}
            onClick={() => runAt(idx)}
            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] ${
              it.danger ? (on ? "bg-red-50 text-red-700" : "text-red-600") : on ? "bg-zinc-100 text-zinc-900" : it.accent ? "font-medium text-zinc-900" : "text-zinc-700"
            }`}
          >
            <Icon name={it.icon} className={`h-4 w-4 ${it.danger ? "text-red-500" : it.accent ? "text-brand-600" : "text-zinc-400"}`} />
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            {it.hint && <kbd className="rounded border border-zinc-200 px-1 text-[10px] font-medium text-zinc-400">{it.hint}</kbd>}
          </button>
        );
      })}
      <p className="mt-1 border-t border-zinc-100 px-2.5 pb-1 pt-1.5 text-[10px] text-zinc-400">Shift + right-click for the browser menu</p>
    </div>,
    document.body
  );
}
