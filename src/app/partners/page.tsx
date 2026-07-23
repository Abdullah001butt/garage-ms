import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Partner } from "@/lib/types";
import { createPartner, updatePartnerShare, deletePartner } from "@/app/partners/actions";
import { Card, PageHeader, EmptyState, PrimaryButton, SecondaryButton, Field } from "@/components/ui";

export default async function PartnersPage() {
  const supabase = await createClient();
  const { data: partners, error } = await supabase
    .from("partners")
    .select("*")
    .order("created_at")
    .returns<Partner[]>();

  const totalShare = (partners ?? []).reduce((s, p) => s + Number(p.share_percentage), 0);

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <PageHeader
        title="Partners"
        description="Business partners and their profit-share percentage."
        action={
          <Link href="/reports/partners">
            <SecondaryButton type="button">View Profit Split Report</SecondaryButton>
          </Link>
        }
      />

      {error && <p className="text-red-600 text-sm mb-4">Failed to load partners: {error.message}</p>}

      {partners && partners.length > 0 && totalShare !== 100 && (
        <Card className="mb-6 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            ⚠ Shares add up to {totalShare}%, not 100%. Adjust so the split is accurate.
          </p>
        </Card>
      )}

      <Card className="mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Share %</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {partners?.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2.5 font-medium text-slate-900">{p.full_name}</td>
                <td className="px-4 py-2.5">
                  <form action={updatePartnerShare.bind(null, p.id)} className="flex gap-2">
                    <input
                      type="number"
                      name="share_percentage"
                      step="0.01"
                      defaultValue={p.share_percentage}
                      className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <button type="submit" className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
                      Save
                    </button>
                  </form>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <form action={deletePartner.bind(null, p.id)}>
                    <button className="text-xs text-red-500 hover:underline">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {partners?.length === 0 && <EmptyState message="No partners added yet." />}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-700 mb-4">Add a partner</p>
        <form action={createPartner} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full name" name="full_name" required />
          <Field label="Share %" name="share_percentage" type="number" step="0.01" required />
          <div className="col-span-2">
            <PrimaryButton type="submit">Add Partner</PrimaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
