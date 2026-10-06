import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Partner } from "@/lib/types";
import { createPartner, updatePartnerShare, deletePartner } from "@/app/partners/actions";
import { Card, PageHeader, EmptyState, PrimaryButton, SecondaryButton, Field, Alert } from "@/components/ui";
import { SlideOver } from "@/components/SlideOver";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export default async function PartnersPage() {
  const supabase = await createClient();
  const { data: partners, error } = await supabase
    .from("partners")
    .select("*")
    .order("created_at")
    .returns<Partner[]>();

  const totalShare = (partners ?? []).reduce((s, p) => s + Number(p.share_percentage), 0);

  return (
    <div className="page page-narrow">
      <PageHeader
        title="Partners"
        description="Business partners and their profit-share percentage."
        action={
          <>
            <Link href="/reports/partners">
              <SecondaryButton type="button" icon="trending">Profit split report</SecondaryButton>
            </Link>
            <SlideOver title="Add a partner" description="Shares across all partners should add up to 100%." triggerLabel="Add Partner">
        <form action={createPartner} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full name" name="full_name" required />
          <Field label="Share %" name="share_percentage" type="number" step="0.01" required />
          <div className="col-span-full">
            <PrimaryButton type="submit">Add Partner</PrimaryButton>
          </div>
        </form>
          </SlideOver>
          </>
        }
      />

      {error && <p className="text-red-600 text-sm mb-4">Failed to load partners: {error.message}</p>}

      {partners && partners.length > 0 && totalShare !== 100 && (
        <Alert className="mb-6" title={`Shares add up to ${totalShare}%, not 100%`}>
          Adjust the percentages so the profit split is accurate.
        </Alert>
      )}

      <Card className="mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Share %</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {partners?.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2.5 font-medium text-zinc-900">{p.full_name}</td>
                <td className="px-4 py-2.5">
                  <form action={updatePartnerShare.bind(null, p.id)} className="flex gap-2">
                    <input
                      type="number"
                      name="share_percentage"
                      step="0.01"
                      defaultValue={p.share_percentage}
                      className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    />
                    <button type="submit" className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50">
                      Save
                    </button>
                  </form>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <ConfirmSubmitButton
                    action={deletePartner.bind(null, p.id)}
                    confirmMessage={`Remove partner "${p.full_name}"? This cannot be undone.`}
                    successMessage="Partner removed."
                  >
                    Remove
                  </ConfirmSubmitButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {partners?.length === 0 && <EmptyState message="No partners added yet." />}
      </Card>

    </div>
  );
}
