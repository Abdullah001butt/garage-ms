import { DocumentList } from "@/components/DocumentList";

export default function EstimatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  return (
    <DocumentList
      documentType="estimate"
      title="Estimates"
      description="Draft quotes for customers. Convert to an invoice once approved."
      newHref="/estimates/new"
      detailBaseHref="/estimates"
      searchParams={searchParams}
    />
  );
}
