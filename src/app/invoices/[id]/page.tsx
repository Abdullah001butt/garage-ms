import { DocumentDetail } from "@/components/DocumentDetail";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sale?: string }>;
}) {
  const { id } = await params;
  const { sale } = await searchParams;
  return <DocumentDetail id={id} expectedType="invoice" backHref="/invoices" justSold={sale === "1"} />;
}
