import { DocumentList } from "@/components/DocumentList";

export default function InvoicesPage() {
  return (
    <DocumentList
      documentType="invoice"
      title="Invoices"
      description="Tax-compliant invoices, generated from job cards or converted estimates."
      detailBaseHref="/invoices"
    />
  );
}
