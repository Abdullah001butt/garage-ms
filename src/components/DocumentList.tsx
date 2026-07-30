import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Badge, EmptyState, PrimaryButton, SecondaryButton } from "@/components/ui";
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

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title={title}
        description={description}
        action={
          <div className="flex flex-wrap gap-2">
            {documentType === "invoice" && (
              <a href="/invoices/export">
                <SecondaryButton type="button">Export Excel</SecondaryButton>
              </a>
            )}
            {newHref && (
              <Link href={newHref}>
                <PrimaryButton type="button">+ New {documentType === "estimate" ? "Estimate" : "Invoice"}</PrimaryButton>
              </Link>
            )}
          </div>
        }
      />

      <form className="flex flex-wrap gap-2 mb-4 text-sm" action={detailBaseHref === "/invoices" ? "/invoices" : "/estimates"}>
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by customer name..."
          className="rounded-lg border border-slate-300 px-3 py-1.5"
        />
        {documentType === "invoice" && (
          <select name="status" defaultValue={statusFilter ?? ""} className="rounded-lg border border-slate-300 px-3 py-1.5">
            <option value="">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        )}
        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
          Filter
        </button>
        {(q || statusFilter) && (
          <a
            href={detailBaseHref === "/invoices" ? "/invoices" : "/estimates"}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-500 hover:bg-slate-50"
          >
            Clear
          </a>
        )}
      </form>

      {error && <p className="text-red-600 text-sm mb-4">Failed to load: {error.message}</p>}

      <Card className="overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {docs?.map((doc) => {
            const subtotal = doc.invoice_items.reduce(
              (sum, item) => sum + item.quantity * item.unit_price,
              0
            );
            const total = subtotal - doc.discount;
            return (
              <li key={doc.id}>
                <Link
                  href={`${detailBaseHref}/${doc.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {doc.customers?.name}
                      {documentType === "invoice" && doc.invoice_number && (
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          {formatInvoiceNumber(doc.invoice_number, doc.created_at)}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Date(doc.created_at).toLocaleDateString()} · Total: AED {total.toFixed(2)}
                    </p>
                  </div>
                  {documentType === "invoice" && (
                    <Badge color={STATUS_COLOR[doc.status]}>{STATUS_LABEL[doc.status]}</Badge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        {docs?.length === 0 && (
          <EmptyState message={q || statusFilter ? "No matching results." : `No ${documentType}s yet.`} />
        )}
      </Card>
    </div>
  );
}
