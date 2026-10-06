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
  customers: { name: string } | null;
  invoice_items: { quantity: number; unit_price: number }[];
};

const STATUS_COLOR: Record<string, "green" | "amber" | "red"> = {
  paid: "green",
  partial: "amber",
  unpaid: "red",
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
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
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  const supabase = await createClient();
  const { q, status: statusFilter } = (await searchParams) ?? {};

  const { data: allDocs, error } = await supabase
    .from("invoices")
    .select("id, status, created_at, vat_rate, discount, invoice_number, customers(name), invoice_items(quantity, unit_price)")
    .eq("document_type", documentType)
    .order("created_at", { ascending: false })
    .returns<Row[]>();

  const docs = (allDocs ?? []).filter((doc) => {
    const matchesQ = !q || (doc.customers?.name ?? "").toLowerCase().includes(q.toLowerCase());
    const matchesStatus = !statusFilter || doc.status === statusFilter;
    return matchesQ && matchesStatus;
  });

  const base = detailBaseHref === "/invoices" ? "/invoices" : "/estimates";
  const statusHref = (value: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (value) params.set("status", value);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const totalOf = (doc: Row) => doc.invoice_items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) - doc.discount;
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>{label}</th>
                <th className={thClass}>Customer</th>
                <th className={`${thClass} hidden sm:table-cell`}>Date</th>
                <th className={`${thClass} text-right`}>Amount</th>
                {documentType === "invoice" && <th className={thClass}>Status</th>}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => {
                const href = `${detailBaseHref}/${doc.id}`;
                const number =
                  documentType === "invoice" ? formatInvoiceNumber(doc.invoice_number, doc.created_at) : null;
                return (
                  <tr key={doc.id} className="group border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link href={href} className="font-mono text-[13px] font-medium text-zinc-900">
                        {number ?? `EST-${doc.id.slice(0, 6).toUpperCase()}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={href} className="font-medium text-zinc-900">
                        {doc.customers?.name ?? "—"}
                      </Link>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-500 tabular sm:table-cell">
                      {new Date(doc.created_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-900 tabular">
                      AED {totalOf(doc).toFixed(2)}
                    </td>
                    {documentType === "invoice" && (
                      <td className="px-4 py-3">
                        <Badge color={STATUS_COLOR[doc.status]} dot>
                          {STATUS_LABEL[doc.status]}
                        </Badge>
                      </td>
                    )}
                    <td className="pr-3">
                      <Link href={href} aria-label="Open" className="text-zinc-300 group-hover:text-zinc-500">
                        <Icon name="chevron-right" className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {docs.length === 0 && (
          <EmptyState icon="file" message={q || statusFilter ? "No matching results." : `No ${documentType}s yet.`} />
        )}
        {docs.length > 0 && (
          <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/60 px-4 py-2 text-xs text-zinc-500">
            <span>
              {docs.length} {documentType}
              {docs.length === 1 ? "" : "s"}
            </span>
            <span className="tabular">
              Total <span className="font-medium text-zinc-900">AED {grandTotal.toFixed(2)}</span>
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
