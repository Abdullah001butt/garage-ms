import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createEstimate } from "@/app/invoices/actions";
import { Card, PageHeader, PrimaryButton, labelClass, inputClass } from "@/components/ui";

export default async function NewEstimatePage() {
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone")
    .order("name");

  return (
    <div className="page page-narrow">
      <Link href="/estimates" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
        ← Back to estimates
      </Link>
      <PageHeader title="New Estimate" description="Pick a customer, then add line items on the next screen." />

      <Card className="p-5">
        <form action={createEstimate}>
          <label className="block mb-4">
            <span className={labelClass}>
              Customer <span className="text-red-500">*</span>
            </span>
            <select name="customer_id" required className={inputClass}>
              <option value="">Select a customer...</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.phone}
                </option>
              ))}
            </select>
          </label>
          <PrimaryButton type="submit">Create Estimate</PrimaryButton>
        </form>
      </Card>
    </div>
  );
}
