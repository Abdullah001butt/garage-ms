import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Badge, EmptyState, PrimaryButton } from "@/components/ui";
import type { DocumentType } from "@/lib/types";

type Row = {
  id: string;
  status: "unpaid" | "paid";
  created_at: string;
  vat_rate: number;
  customers: { name: string } | null;
  invoice_items: { quantity: number; unit_price: number }[];
};

export async function DocumentList({
  documentType,
  title,
  description,
  newHref,
  detailBaseHref,
}: {
  documentType: DocumentType;
  title: string;
  description: string;
  newHref?: string;
  detailBaseHref: string;
}) {
  const supabase = await createClient();

  const { data: docs, error } = await supabase
    .from("invoices")
    .select("id, status, created_at, vat_rate, customers(name), invoice_items(quantity, unit_price)")
    .eq("document_type", documentType)
    .order("created_at", { ascending: false })
    .returns<Row[]>();

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title={title}
        description={description}
        action={
          newHref && (
            <Link href={newHref}>
              <PrimaryButton type="button">+ New {documentType === "estimate" ? "Estimate" : "Invoice"}</PrimaryButton>
            </Link>
          )
        }
      />

      {error && <p className="text-red-600 text-sm mb-4">Failed to load: {error.message}</p>}

      <Card className="overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {docs?.map((doc) => {
            const subtotal = doc.invoice_items.reduce(
              (sum, item) => sum + item.quantity * item.unit_price,
              0
            );
            const total = subtotal * (1 + doc.vat_rate / 100);
            return (
              <li key={doc.id}>
                <Link
                  href={`${detailBaseHref}/${doc.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">{doc.customers?.name}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(doc.created_at).toLocaleDateString()} · Total: AED {total.toFixed(2)}
                    </p>
                  </div>
                  {documentType === "invoice" && (
                    <Badge color={doc.status === "paid" ? "green" : "red"}>
                      {doc.status === "paid" ? "Paid" : "Unpaid"}
                    </Badge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        {docs?.length === 0 && <EmptyState message={`No ${documentType}s yet.`} />}
      </Card>
    </div>
  );
}
