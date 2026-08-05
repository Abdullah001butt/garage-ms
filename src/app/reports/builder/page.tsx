import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, SecondaryButton, EmptyState, inputClass, labelClass } from "@/components/ui";
import { fetchBuilderRows } from "@/lib/reports/builder";

type CustomerOption = { id: string; name: string };
type JobRow = { mechanic_name: string | null };

export default async function ReportBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; customer?: string; item_type?: string; mechanic?: string }>;
}) {
  const { from, to, customer, item_type, mechanic } = await searchParams;
  const supabase = await createClient();

  const [{ data: customers }, { data: jobs }] = await Promise.all([
    supabase.from("customers").select("id, name").order("name").returns<CustomerOption[]>(),
    supabase.from("job_cards").select("mechanic_name").not("mechanic_name", "is", null).returns<JobRow[]>(),
  ]);

  const mechanics = [...new Set((jobs ?? []).map((j) => j.mechanic_name).filter(Boolean))] as string[];

  const rows = await fetchBuilderRows(supabase, {
    from,
    to,
    customerId: customer,
    itemType: item_type,
    mechanic,
  });

  const total = rows.reduce((s, r) => s + r.line_total, 0);

  const exportParams = new URLSearchParams();
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  if (customer) exportParams.set("customer", customer);
  if (item_type) exportParams.set("item_type", item_type);
  if (mechanic) exportParams.set("mechanic", mechanic);

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <PageHeader
        title="Report Builder"
        description="Build a custom report from your invoice data with any combination of filters."
        action={
          <a href={`/reports/builder/export?${exportParams.toString()}`}>
            <SecondaryButton type="button">Export Excel</SecondaryButton>
          </a>
        }
      />

      <Card className="mb-6 p-4">
        <form className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <label className="block">
            <span className={labelClass}>From</span>
            <input type="date" name="from" defaultValue={from ?? ""} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>To</span>
            <input type="date" name="to" defaultValue={to ?? ""} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Customer</span>
            <select name="customer" defaultValue={customer ?? ""} className={inputClass}>
              <option value="">All customers</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Item Type</span>
            <select name="item_type" defaultValue={item_type ?? ""} className={inputClass}>
              <option value="">All types</option>
              <option value="part">Part</option>
              <option value="labor">Labor</option>
              <option value="service">Service</option>
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Mechanic</span>
            <select name="mechanic" defaultValue={mechanic ?? ""} className={inputClass}>
              <option value="">All mechanics</option>
              {mechanics.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-5">
            <SecondaryButton type="submit">Apply Filters</SecondaryButton>
          </div>
        </form>
      </Card>

      <Card className="mb-4 p-4">
        <p className="text-xs text-slate-500">Total (filtered)</p>
        <p className="text-2xl font-bold text-slate-900">AED {total.toFixed(2)}</p>
        <p className="text-xs text-slate-400 mt-0.5">{rows.length} line item(s)</p>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">Customer</th>
              <th className="px-3 py-2.5 font-medium">Vehicle</th>
              <th className="px-3 py-2.5 font-medium">Mechanic</th>
              <th className="px-3 py-2.5 font-medium">Description</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 font-medium text-right">Qty</th>
              <th className="px-3 py-2.5 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2 text-slate-500">{new Date(r.invoice_date).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-slate-900">{r.customer_name}</td>
                <td className="px-3 py-2 text-slate-500">{r.vehicle}</td>
                <td className="px-3 py-2 text-slate-500">{r.mechanic_name ?? "—"}</td>
                <td className="px-3 py-2 text-slate-700">{r.description}</td>
                <td className="px-3 py-2 capitalize text-slate-500">{r.item_type}</td>
                <td className="px-3 py-2 text-right text-slate-500">{r.quantity}</td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">AED {r.line_total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState message="No results for these filters." />}
      </Card>
    </div>
  );
}
