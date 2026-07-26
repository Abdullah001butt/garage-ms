import { DocumentList } from "@/components/DocumentList";

export default function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  return (
    <DocumentList
      documentType="invoice"
      title="Invoices"
      description="Tax-compliant invoices, generated from job cards or converted estimates."
      detailBaseHref="/invoices"
      searchParams={searchParams}
    />
  );
}
