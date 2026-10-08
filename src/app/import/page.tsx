import { PageHeader, Card, EmptyState } from "@/components/ui";
import { ImportWizard } from "@/components/ImportWizard";
import { getCurrentUserAndProfile } from "@/lib/auth";

export default async function ImportPage() {
  const { profile } = await getCurrentUserAndProfile();
  return (
    <div className="page">
      <PageHeader title="Import from Excel" description="Bring in old customers, cars and parts in one go — check everything before it is saved." />
      {profile?.role === "owner" ? (
        <ImportWizard />
      ) : (
        <Card>
          <EmptyState icon="shield" title="Owners only" message="Ask the garage owner to import data." />
        </Card>
      )}
    </div>
  );
}
