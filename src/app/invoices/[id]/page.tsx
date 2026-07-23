import { DocumentDetail } from "@/components/DocumentDetail";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentDetail id={id} expectedType="invoice" backHref="/invoices" />;
}
