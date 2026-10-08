"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import { PlateBadge } from "@/components/PlateBadge";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export type PeekType = "customer" | "invoice" | "job";

/** Opens the quick-preview side panel from anywhere (rows, cards, buttons). */
export function openPeek(type: PeekType, id: string) {
  window.dispatchEvent(new CustomEvent("peek:open", { detail: { type, id } }));
}

const aed = (n: number) => `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" }) : "—";

const STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  partial: { label: "Part paid", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  unpaid: { label: "Unpaid", cls: "bg-red-50 text-red-700 ring-red-200" },
  pending: { label: "Pending", cls: "bg-zinc-100 text-zinc-700 ring-zinc-200" },
  in_progress: { label: "In progress", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

function Pill({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: "bg-zinc-100 text-zinc-700 ring-zinc-200" };
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${s.cls}`}>{s.label}</span>;
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-t border-zinc-200 px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-[13px]">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-medium text-zinc-900 tabular">{value}</dd>
    </div>
  );
}

const actionCls = "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium";

/* eslint-disable @typescript-eslint/no-explicit-any -- payload shape comes from /api/peek */
function CustomerView({ d }: { d: any }) {
  const c = d.customer;
  return (
    <>
      <div className="px-5 pb-4">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200">
          <div className="bg-white p-3">
            <p className="text-xs text-zinc-500">Balance due</p>
            <p className={`mt-0.5 text-lg font-semibold tabular ${d.balance > 0.01 ? "text-red-700" : "text-emerald-700"}`}>{aed(d.balance)}</p>
          </div>
          <div className="bg-white p-3">
            <p className="text-xs text-zinc-500">Lifetime spend</p>
            <p className="mt-0.5 text-lg font-semibold tabular text-zinc-900">{aed(d.lifetime)}</p>
          </div>
        </div>
      </div>
      <Section title="Contact">
        <dl>
          <Row label="Mobile" value={c.phone} />
          {c.email && <Row label="Email" value={c.email} />}
          {c.city && <Row label="City" value={c.city} />}
          <Row label="Customer since" value={date(c.created_at)} />
        </dl>
      </Section>
      <Section title={`Vehicles · ${c.vehicles?.length ?? 0}`}>
        {(c.vehicles ?? []).length === 0 ? (
          <p className="text-[13px] text-zinc-400">No vehicles on file.</p>
        ) : (
          <ul className="space-y-2">
            {c.vehicles.map((v: any) => (
              <li key={v.id}>
                <Link href={`/vehicles/${v.id}/passport`} className="flex items-center gap-3 rounded-md p-1 hover:bg-zinc-50">
                  <PlateBadge plateNumber={v.plate_number} emirate={v.emirate} />
                  <span className="truncate text-[13px] text-zinc-700">{[v.make, v.model, v.year].filter(Boolean).join(" ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {d.openJobs.length > 0 && (
        <Section title="Open jobs">
          <ul className="space-y-1.5">
            {d.openJobs.map((j: any) => (
              <li key={j.id} className="flex items-center justify-between gap-3 text-[13px]">
                <Link href={`/jobs/${j.id}`} className="min-w-0 truncate text-zinc-800 hover:underline">
                  {j.description}
                </Link>
                <Pill status={j.status} />
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={`Recent invoices · ${d.invoiceCount}`}>
        {d.invoices.length === 0 ? (
          <p className="text-[13px] text-zinc-400">No invoices yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {d.invoices.map((inv: any) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <Link href={`/invoices/${inv.id}`} className="min-w-0 hover:underline">
                  <span className="block font-display text-[15px] font-semibold tracking-[0.02em] text-zinc-900">{inv.number}</span>
                  <span className="block text-xs text-zinc-500">{date(inv.created_at)}</span>
                </Link>
                <span className="text-right">
                  <span className="block font-medium tabular text-zinc-900">{aed(inv.total)}</span>
                  <Pill status={inv.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function InvoiceView({ d }: { d: any }) {
  const inv = d.invoice;
  const v = inv.job_cards?.vehicles;
  return (
    <>
      <div className="px-5 pb-4">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200">
          <div className="bg-white p-3">
            <p className="text-xs text-zinc-500">Total</p>
            <p className="mt-0.5 text-lg font-semibold tabular text-zinc-900">{aed(d.total)}</p>
          </div>
          <div className="bg-white p-3">
            <p className="text-xs text-zinc-500">Balance due</p>
            <p className={`mt-0.5 text-lg font-semibold tabular ${d.balance > 0.01 ? "text-red-700" : "text-emerald-700"}`}>{aed(d.balance)}</p>
          </div>
        </div>
      </div>
      <Section title="Details">
        <dl>
          <Row label="Customer" value={inv.customers?.name ?? "—"} />
          <Row label="Date" value={date(inv.created_at)} />
          {v && <Row label="Vehicle" value={<PlateBadge plateNumber={v.plate_number} emirate={v.emirate} />} />}
          {inv.job_cards?.description && <Row label="Work" value={<span className="font-normal">{inv.job_cards.description}</span>} />}
        </dl>
      </Section>
      <Section title={`Line items · ${inv.invoice_items?.length ?? 0}`}>
        <ul className="divide-y divide-zinc-100">
          {(inv.invoice_items ?? []).map((it: any, i: number) => (
            <li key={i} className="flex justify-between gap-3 py-1.5 text-[13px]">
              <span className="min-w-0 text-zinc-700">
                <span className="tabular text-zinc-400">{it.quantity} ×</span> {it.description}
              </span>
              <span className="shrink-0 tabular text-zinc-900">{aed(it.quantity * it.unit_price)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 border-t border-zinc-200 pt-2">
          <Row label="Subtotal" value={aed(d.subtotal)} />
          <Row label={`VAT ${inv.vat_rate}%`} value={aed(d.vat)} />
          {Number(inv.discount) > 0 && <Row label="Discount" value={`− ${aed(Number(inv.discount))}`} />}
          <Row label="Paid" value={aed(d.paid)} />
        </dl>
      </Section>
      {(inv.payments ?? []).length > 0 && (
        <Section title="Payments">
          <ul className="space-y-1">
            {inv.payments.map((p: any, i: number) => (
              <li key={i} className="flex justify-between text-[13px]">
                <span className="capitalize text-zinc-600">
                  {date(p.paid_at)} · {String(p.method).replace("_", " ")}
                </span>
                <span className="tabular text-emerald-700">{aed(Number(p.amount))}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

function JobView({ d }: { d: any }) {
  const job = d.job;
  const steps = ["pending", "in_progress", "completed"];
  const reached = steps.indexOf(job.status);
  return (
    <>
      <div className="px-5 pb-4">
        <ol className="flex items-center">
          {["Received", "In progress", "Completed", "Invoiced"].map((label, i) => {
            const done = i <= reached || (i === 3 && !!d.invoice);
            return (
              <li key={label} className={`flex items-center ${i < 3 ? "flex-1" : ""}`}>
                <span className="flex flex-col items-center gap-1">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${done ? "bg-zinc-900 text-white" : "border border-zinc-300 text-zinc-400"}`}>
                    {done ? <Icon name="check" className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className={`whitespace-nowrap text-[10px] ${done ? "text-zinc-800" : "text-zinc-400"}`}>{label}</span>
                </span>
                {i < 3 && <span className={`mx-1 mb-4 h-px flex-1 ${i < reached ? "bg-zinc-900" : "bg-zinc-200"}`} />}
              </li>
            );
          })}
        </ol>
      </div>
      <Section title="Work requested">
        <p className="text-[13px] leading-relaxed text-zinc-800">{job.description}</p>
      </Section>
      <Section title="Details">
        <dl>
          <Row label="Customer" value={job.customers?.name ?? "—"} />
          <Row label="Vehicle" value={[job.vehicles?.make, job.vehicles?.model, job.vehicles?.year].filter(Boolean).join(" ") || "—"} />
          <Row label="Mechanic" value={job.mechanic_name ?? "Unassigned"} />
          <Row label="Odometer" value={job.odometer ? `${Number(job.odometer).toLocaleString("en-US")} km` : "—"} />
          <Row label="Opened" value={date(job.created_at)} />
          <Row label="Completed" value={date(job.completed_at)} />
          <Row
            label="Invoice"
            value={
              d.invoice ? (
                <Link href={`/invoices/${d.invoice.id}`} className="font-semibold hover:underline">
                  {d.invoice.number}
                </Link>
              ) : (
                "Not invoiced"
              )
            }
          />
        </dl>
      </Section>
    </>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Loads the quick-view summary for one record. */
function usePeekData(type: PeekType, id: string) {
  const [state, setState] = useState<{ key: string; data: Record<string, unknown> | null; error: string | null }>({ key: "", data: null, error: null });
  const key = `${type}:${id}`;
  useEffect(() => {
    let alive = true;
    fetch(`/api/peek?type=${type}&id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Could not load");
        if (alive) setState({ key, data: json, error: null });
      })
      .catch((err) => alive && setState({ key, data: null, error: err.message }));
    return () => {
      alive = false;
    };
  }, [type, id, key]);
  // Never show the previous record's data while the next one loads.
  return state.key === key ? state : { key, data: null, error: null };
}

/** Header, summary and actions for one record — used by the overlay and by the docked split-view pane. */
export function PeekPanel({ type, id, onClose, docked = false }: { type: PeekType; id: string; onClose: () => void; docked?: boolean }) {
  const { data, error } = usePeekData(type, id);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const d = data as any;
  const href =
    type === "customer" ? `/customers/${id}` : type === "invoice" ? `/${d?.invoice?.document_type === "estimate" ? "estimates" : "invoices"}/${id}` : `/jobs/${id}`;
  const title = !d ? "Loading…" : type === "customer" ? d.customer.name : type === "invoice" ? (d.invoice.document_type === "estimate" ? "Estimate" : d.invoice.number ?? "Invoice") : `${d.job.vehicles?.plate_number ?? "Job"}`;
  const subtitle = !d
    ? ""
    : type === "customer"
      ? `${d.customer.customer_type === "company" ? "Company" : "Individual"}${d.customer.city ? ` · ${d.customer.city}` : ""}`
      : type === "invoice"
        ? d.invoice.customers?.name
        : [d.job.vehicles?.make, d.job.vehicles?.model].filter(Boolean).join(" ");
  const status = d ? (type === "invoice" ? d.invoice.status : type === "job" ? d.job.status : null) : null;
  const phone: string | undefined = d ? (type === "customer" ? d.customer.phone : type === "invoice" ? d.invoice.customers?.phone : d.job.customers?.phone) : undefined;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <>
      <div className="flex items-start gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{docked ? "Preview" : "Quick view"} · {type}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className={`truncate text-lg font-semibold text-zinc-900 ${type === "invoice" ? "font-display tracking-[0.02em]" : ""}`}>{title}</h2>
            {status && <Pill status={status} />}
          </div>
          {subtitle && <p className="truncate text-[13px] text-zinc-500">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && <p className="mx-5 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
        {!d && !error && (
          <div className="space-y-3 px-5">
            <div className="skeleton h-16 rounded-lg" />
            <div className="skeleton h-4 w-2/3 rounded" />
            <div className="skeleton h-4 w-1/2 rounded" />
            <div className="skeleton h-24 rounded-lg" />
          </div>
        )}
        {d && (
          <div key={id} className="peek-fade">
            {type === "customer" && <CustomerView d={d} />}
            {type === "invoice" && <InvoiceView d={d} />}
            {type === "job" && <JobView d={d} />}
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-3">
        {phone && (
          <a href={buildWhatsAppLink(phone, "")} target="_blank" rel="noopener noreferrer" className={`${actionCls} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50`}>
            <Icon name="message" className="h-4 w-4 text-emerald-600" />
            WhatsApp
          </a>
        )}
        <Link href={href} onClick={docked ? undefined : onClose} className={`${actionCls} bg-zinc-900 text-white hover:bg-zinc-800`}>
          Open full page
          <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}

/** Mounted once in the layout; listens for openPeek() calls. */
export function PeekHost() {
  const [target, setTarget] = useState<{ type: PeekType; id: string } | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => setTarget((e as CustomEvent<{ type: PeekType; id: string }>).detail);
    window.addEventListener("peek:open", onOpen);
    return () => window.removeEventListener("peek:open", onOpen);
  }, []);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setTarget(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [target]);

  if (!target) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 print:hidden" role="dialog" aria-modal="true" aria-label="Quick view">
      <div className="absolute inset-0 bg-zinc-950/30" onClick={() => setTarget(null)} />
      <aside className="slide-in-right absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <PeekPanel type={target.type} id={target.id} onClose={() => setTarget(null)} />
      </aside>
    </div>,
    document.body
  );
}

/** Small 👁 button for list rows. */
export function PeekButton({ type, id, label = "Quick view" }: { type: PeekType; id: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openPeek(type, id);
      }}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
}
