import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createEstimate } from "@/app/invoices/actions";
import { Card, PageHeader, PrimaryButton, labelClass, inputClass } from "@/components/ui";
import { Icon } from "@/components/icons";

const STEPS = [
  { title: "Choose the customer", detail: "Who the quote is for." },
  { title: "Add line items", detail: "Parts, labour and services with prices." },
  { title: "Send for approval", detail: "Print, PDF or WhatsApp — then convert to an invoice." },
];

export default async function NewEstimatePage() {
  const supabase = await createClient();
  const { data: customers } = await supabase.from("customers").select("id, name, phone").order("name");

  return (
    <div className="page page-narrow">
      <Link href="/estimates" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
        ← Back to estimates
      </Link>
      <PageHeader title="New Estimate" description="Quote a job before the work starts." />

      <div className="grid gap-6 md:grid-cols-[1fr_15rem]">
        <Card className="p-5">
          <form action={createEstimate} className="space-y-4">
            <label className="block">
              <span className={labelClass}>
                Customer <span className="text-brand-600">*</span>
              </span>
              <select name="customer_id" required className={inputClass}>
                <option value="">Select a customer…</option>
                {customers?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block text-xs text-zinc-500">
                Not on file yet?{" "}
                <Link href="/customers/new" className="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900">
                  Add the customer first
                </Link>
                .
              </span>
            </label>
            <div className="flex justify-end border-t border-zinc-100 pt-4">
              <PrimaryButton type="submit" icon="arrow-right">
                Create estimate
              </PrimaryButton>
            </div>
          </form>
        </Card>

        <ol className="space-y-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  i === 0 ? "bg-brand-600 text-white" : "border border-zinc-300 bg-white text-zinc-500"
                }`}
              >
                {i + 1}
              </span>
              <div>
                <p className={`text-[13px] font-medium ${i === 0 ? "text-zinc-900" : "text-zinc-600"}`}>{step.title}</p>
                <p className="text-xs text-zinc-500">{step.detail}</p>
              </div>
            </li>
          ))}
          <li className="flex items-center gap-2 pt-1 text-xs text-zinc-400">
            <Icon name="info" className="h-3.5 w-3.5" />
            Estimates don&apos;t count as sales until converted.
          </li>
        </ol>
      </div>
    </div>
  );
}
