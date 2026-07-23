import { DocumentDetail } from "@/components/DocumentDetail";

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentDetail id={id} expectedType="estimate" backHref="/estimates" />;
}
