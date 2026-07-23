import { DocumentList } from "@/components/DocumentList";

export default function EstimatesPage() {
  return (
    <DocumentList
      documentType="estimate"
      title="Estimates"
      description="Draft quotes for customers. Convert to an invoice once approved."
      newHref="/estimates/new"
      detailBaseHref="/estimates"
    />
  );
}
