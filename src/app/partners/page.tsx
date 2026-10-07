import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Partner } from "@/lib/types";
import { createPartner, updatePartnerShare, deletePartner } from "@/app/partners/actions";
import { Alert, Card, EmptyState, Field, PageHeader, PrimaryButton, SecondaryButton } from "@/components/ui";
import { RowMenu, RowMenuDelete } from "@/components/RowMenu";
import { SlideOver } from "@/components/SlideOver";
import { Icon } from "@/components/icons";

const COLORS = ["bg-zinc-900", "bg-brand-600", "bg-[#2a78d6]", "bg-[#eb6834]", "bg-emerald-600", "bg-amber-500"];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default async function PartnersPage() {
  const supabase = await createClient();
  const { data: partners, error } = await supabase.from("partners").select("*").order("created_at").returns<Partner[]>();
  const totalShare = (partners ?? []).reduce((s, p) => s + Number(p.share_percentage), 0);
  const balanced = Math.abs(totalShare - 100) < 0.01;

  return (
    <div className="page">
      <PageHeader
        title="Partners"
        description="Business partners and their share of the monthly profit."
        action={
          <>
            <Link href="/reports/partners">
              <SecondaryButton type="button" icon="trending">
                Profit split report
              </SecondaryButton>
            </Link>
            <SlideOver title="Add a partner" description="Shares across all partners should add up to 100%." triggerLabel="Add partner">
              <form action={createPartner} className="space-y-4">
                <Field label="Full name" name="full_name" required />
                <Field label="Share %" name="share_percentage" type="number" step="0.01" required />
                <PrimaryButton type="submit" className="w-full">
                  Add partner
                </PrimaryButton>
              </form>
            </SlideOver>
          </>
        }
      />

      {error && <p className="mb-4 text-sm text-red-600">Failed to load partners: {error.message}</p>}

      {(partners?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState icon="user" message="No partners added yet. Add each partner with their profit share." />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid content-start gap-4 sm:grid-cols-2">
            {partners!.map((p, i) => (
              <Card key={p.id} className="p-5">
                <div className="flex items-start gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${COLORS[i % COLORS.length]}`}>
                    {initials(p.full_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900">{p.full_name}</p>
                    <p className="text-xs text-zinc-500">Partner since {new Date(p.created_at).getFullYear()}</p>
                  </div>
                  <RowMenu>
                    <RowMenuDelete
                      action={deletePartner.bind(null, p.id)}
                      confirmMessage={`Remove partner "${p.full_name}"? This cannot be undone.`}
                      successMessage="Partner removed."
                      label="Remove"
                    />
                  </RowMenu>
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <p className="text-3xl font-semibold tracking-tight tabular text-zinc-900">{p.share_percentage}%</p>
                  <p className="text-xs text-zinc-500">of net profit</p>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-zinc-100">
                  <div className={`h-1.5 rounded-full ${COLORS[i % COLORS.length]}`} style={{ width: `${Math.min(100, Number(p.share_percentage))}%` }} />
                </div>
                <form action={updatePartnerShare.bind(null, p.id)} className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-4">
                  <label className="text-xs font-medium text-zinc-500" htmlFor={`share-${p.id}`}>
                    Change share
                  </label>
                  <input
                    id={`share-${p.id}`}
                    type="number"
                    name="share_percentage"
                    step="0.01"
                    defaultValue={p.share_percentage}
                    className="ml-auto h-8 w-24 rounded-md border border-zinc-300 px-2 text-right text-sm tabular"
                  />
                  <SecondaryButton type="submit" className="h-8! px-2.5!">
                    Save
                  </SecondaryButton>
                </form>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <p className="text-[13px] font-medium text-zinc-500">Total shares</p>
              <p className={`mt-1 text-3xl font-semibold tracking-tight tabular ${balanced ? "text-zinc-900" : "text-amber-700"}`}>{totalShare}%</p>
              <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-zinc-100">
                {partners!.map((p, i) => (
                  <div key={p.id} className={COLORS[i % COLORS.length]} style={{ width: `${Number(p.share_percentage)}%` }} />
                ))}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
                <Icon name={balanced ? "check-circle" : "alert"} className={`h-3.5 w-3.5 ${balanced ? "text-emerald-600" : "text-amber-600"}`} />
                {balanced ? "Shares add up to 100%." : `${totalShare > 100 ? "Over" : "Under"} 100% by ${Math.abs(100 - totalShare).toFixed(2)}%.`}
              </p>
            </Card>
            {!balanced && (
              <Alert title={`Shares add up to ${totalShare}%`}>Adjust the percentages so the profit split report is accurate.</Alert>
            )}
            <Link href="/reports/partners" className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-[13px] font-medium text-zinc-700 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-zinc-300">
              See this month&apos;s profit split
              <Icon name="arrow-right" className="h-4 w-4 text-zinc-400" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
