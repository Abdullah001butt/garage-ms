import { ctxAttr } from "@/lib/ctx";
import { SplitView } from "@/components/SplitView";
import { Morph } from "@/components/Morph";
import { formatDate, formatAed } from "@/lib/format";
import { PeekButton } from "@/components/Peek";
import { SortHeader, sortRows } from "@/components/SortHeader";
import { BulkBar, BulkSelectProvider, RowCheckbox, SelectAllCheckbox } from "@/components/BulkSelect";
import { BulkLinkButton, BulkRemindButton } from "@/components/BulkActions";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Badge, EmptyState, PrimaryButton, SecondaryButton, SegmentedLinks, inputClass, theadClass, thClass } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { DocumentType } from "@/lib/types";
import { formatInvoiceNumber } from "@/lib/invoice-number";

type Row = {
  id: string;
  status: "unpaid" | "partial" | "paid";
  created_at: string;
  vat_rate: number;
  discount: number;
  invoice_number: number | null;
  customers: { name: string; phone: string | null } | null;
  invoice_items: { quantity: number; unit_price: number }[];
  payments: { amount: number }[];
};

const STATUS_COLOR: Record<string, "green" | "amber" | "red" | "gray"> = {
  paid: "green",
  partial: "amber",
  unpaid: "red",
  credited: "gray",
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
  credited: "Credited",
};

export async function DocumentList({
  documentType,
  title,
  description,
  newHref,
  detailBaseHref,
  searchParams,
}: {
  documentType: DocumentType;
  title: string;
  description: string;
  newHref?: string;
  detailBaseHref: string;
  searchParams?: Promise<{ q?: string; status?: string; sort?: string; dir?: string }>;
}) {
  const supabase = await createClient();
  const { q, status: statusFilter, sort = "date", dir = "desc" } = (await searchParams) ?? {};

  const { data: allDocs, error } = await supabase
    .from("invoices")
    .select("id, status, created_at, vat_rate, discount, invoice_number, customers(name, phone), invoice_items(quantity, unit_price), payments(amount)")
    .eq("document_type", documentType)
    .order("created_at", { ascending: false })
    .returns<Row[]>();

  // Totals include VAT and discount, matching the invoice page and the dues report.
  const totalOf = (doc: Row) => {
    const sub = doc.invoice_items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    return sub * (1 + Number(doc.vat_rate) / 100) - Number(doc.discount);
  };
  const balanceOf = (doc: Row) => Math.max(totalOf(doc) - (doc.payments ?? []).reduce((s, p) => s + Number(p.amount), 0), 0);

  const docs = sortRows(
    (allDocs ?? []).filter((doc) => {
      const matchesQ = !q || (doc.customers?.name ?? "").toLowerCase().includes(q.toLowerCase());
      const matchesStatus = !statusFilter || doc.status === statusFilter;
      return matchesQ && matchesStatus;
    }),
    (d) => (sort === "customer" ? d.customers?.name : sort === "amount" ? totalOf(d) : sort === "number" ? d.invoice_number ?? 0 : sort === "status" ? d.status : d.created_at),
    dir
  );

  const base = detailBaseHref === "/invoices" ? "/invoices" : "/estimates";
  const statusHref = (value: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (value) params.set("status", value);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const sortHref = (field: string, d: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (statusFilter) params.set("status", statusFilter);
    params.set("sort", field);
    params.set("dir", d);
    return `${base}?${params.toString()}`;
  };
  const targets = docs.map((d) => {
    const first = d.customers?.name?.split(" ")[0] ?? "there";
    return {
      id: d.id,
      name: d.customers?.name ?? "Customer",
      phone: d.customers?.phone ?? null,
      detail: `${formatInvoiceNumber(d.invoice_number, d.created_at) ?? "Estimate"} · ${formatAed(documentType === "invoice" ? balanceOf(d) : totalOf(d))}`,
      message:
        documentType === "invoice"
          ? `Hi ${first}, a friendly reminder from Al Bahir Garage that ${formatAed(balanceOf(d))} is still due on invoice ${formatInvoiceNumber(d.invoice_number, d.created_at)}. Thank you!`
          : `Hi ${first}, following up on your estimate of ${formatAed(totalOf(d))} from Al Bahir Garage. Shall we go ahead with the work?`,
    };
  });
  const grandTotal = docs.reduce((sum, doc) => sum + totalOf(doc), 0);
  const label = documentType === "estimate" ? "Estimate" : "Invoice";

  return (
    <div className="page">
      <PageHeader
        title={title}
        description={description}
        action={
          <>
            {documentType === "invoice" && (
              <a href="/invoices/export">
                <SecondaryButton type="button" icon="download">
                  Export
                </SecondaryButton>
              </a>
            )}
            {newHref && (
              <Link href={newHref}>
                <PrimaryButton type="button">{`+ New ${label}`}</PrimaryButton>
              </Link>
            )}
          </>
        }
      />

      {error && <p className="mb-4 text-sm text-red-600">Failed to load: {error.message}</p>}

      <BulkSelectProvider ids={docs.map((d) => d.id)}>
      <SplitView type="invoice" storageKey={`split:${documentType}s`} hrefBase={detailBaseHref}>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-200 p-3 sm:flex-row sm:items-center sm:justify-between">
          {documentType === "invoice" ? (
            <SegmentedLinks
              items={[
                { value: "", label: "All" },
                { value: "unpaid", label: "Unpaid" },
                { value: "partial", label: "Partial" },
                { value: "paid", label: "Paid" },
              ].map((f) => ({ label: f.label, href: statusHref(f.value), active: (statusFilter ?? "") === f.value }))}
            />
          ) : (
            <span className="px-1 text-[13px] text-zinc-500">All estimates</span>
          )}
          <form action={base} className="relative w-full sm:w-72">
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input type="text" name="q" defaultValue={q ?? ""} placeholder="Filter by customer" className={`${inputClass} pl-8`} />
          </form>
        </div>

        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th className="w-10 pl-4">
                  <SelectAllCheckbox />
                </th>
                <SortHeader label={label} field="number" sort={sort} dir={dir} href={sortHref} />
                <SortHeader label="Customer" field="customer" sort={sort} dir={dir} href={sortHref} defaultDir="asc" className="hidden sm:table-cell" />
                <SortHeader label="Date" field="date" sort={sort} dir={dir} href={sortHref} className="hidden sm:table-cell" />
                <SortHeader label="Amount" field="amount" sort={sort} dir={dir} href={sortHref} align="right" />
                {documentType === "invoice" && <SortHeader label="Status" field="status" sort={sort} dir={dir} href={sortHref} defaultDir="asc" className="hidden sm:table-cell" />}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => {
                const href = `${detailBaseHref}/${doc.id}`;
                const number =
                  documentType === "invoice" ? formatInvoiceNumber(doc.invoice_number, doc.created_at) : null;
                return (
                  <tr
                    key={doc.id}
                    data-split-id={doc.id}
                    {...ctxAttr({
                      t: "invoice",
                      id: doc.id,
                      doc: documentType,
                      number: number ?? `EST-${doc.id.slice(0, 6).toUpperCase()}`,
                      status: doc.status,
                      balance: documentType === "invoice" ? Math.round(balanceOf(doc) * 100) / 100 : undefined,
                      customer: doc.customers?.name,
                      phone: doc.customers?.phone ?? undefined,
                    })}
                    className="group border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
                    <td className="w-10 pl-4">
                      <RowCheckbox id={doc.id} label={doc.customers?.name} />
                    </td>
                    <td className="px-4 py-3 sm:whitespace-nowrap">
                      <Link href={href} className="whitespace-nowrap font-mono text-[13px] font-medium text-zinc-900">
                        <Morph name={`doc-${doc.id}`}>
                          <span className="inline-block">{number ?? `EST-${doc.id.slice(0, 6).toUpperCase()}`}</span>
                        </Morph>
                      </Link>
                      <p className="mt-0.5 text-xs text-zinc-500 sm:hidden">
                        {doc.customers?.name ?? "—"} · {formatDate(doc.created_at)}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <Link href={href} className="font-medium text-zinc-900">
                        {doc.customers?.name ?? "—"}
                      </Link>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-500 tabular sm:table-cell">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-900 tabular">
                      {formatAed(totalOf(doc))}
                      {documentType === "invoice" && (
                        <div className="mt-1 sm:hidden">
                          <Badge color={STATUS_COLOR[doc.status]} dot>
                            {STATUS_LABEL[doc.status]}
                          </Badge>
                        </div>
                      )}
                    </td>
                    {documentType === "invoice" && (
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <Badge color={STATUS_COLOR[doc.status]} dot>
                          {STATUS_LABEL[doc.status]}
                        </Badge>
                      </td>
                    )}
                    <td className="pr-3">
                      <span className="flex items-center justify-end gap-0.5">
                        <PeekButton type="invoice" id={doc.id} />
                        <Link href={href} aria-label="Open" className="hidden text-zinc-300 group-hover:text-zinc-500 sm:block">
                          <Icon name="chevron-right" className="h-4 w-4" />
                        </Link>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {docs.length === 0 && (
          <EmptyState
            icon="file"
            title={q || statusFilter ? "No matches" : `No ${documentType}s yet`}
            message={q || statusFilter ? "Try a different filter or customer name." : documentType === "invoice" ? "Invoices are created from finished job cards or counter sales." : "Quote a job before work starts, then convert it to an invoice."}
            action={q || statusFilter ? undefined : documentType === "invoice" ? <><Link href="/jobs" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-600 px-3.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(16,24,40,0.08)] hover:bg-brand-700">Go to job cards</Link><Link href="/counter-sale" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50">Counter sale</Link></> : <><Link href="/estimates/new" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-600 px-3.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(16,24,40,0.08)] hover:bg-brand-700">+ New estimate</Link></>}
          />
        )}
        {docs.length > 0 && (
          <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/60 px-4 py-2 text-xs text-zinc-500">
            <span>
              {docs.length} {documentType}
              {docs.length === 1 ? "" : "s"}
            </span>
            <span className="tabular">
              Total <span className="font-medium text-zinc-900">{formatAed(grandTotal)}</span>
            </span>
          </div>
        )}
      </Card>
      </SplitView>
      <BulkBar noun={documentType}>
        <BulkRemindButton targets={targets} label={documentType === "invoice" ? "WhatsApp reminders" : "WhatsApp follow-ups"} />
        {documentType === "invoice" && <BulkLinkButton href="/invoices/export" label="Export" />}
      </BulkBar>
      </BulkSelectProvider>
    </div>
  );
}
