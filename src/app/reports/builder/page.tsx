import { formatDate, formatAed } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader, Panel, PrimaryButton, SecondaryButton, inputClass, labelClass, tdClass, thClass, theadClass } from "@/components/ui";
import { StatStrip } from "@/components/report-ui";

const TYPE_LABEL: Record<string, string> = { part: "Part", labor: "Labour", service: "Service" };
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
  const byType = (t: string) => rows.filter((r) => r.item_type === t).reduce((s, r) => s + r.line_total, 0);

  const exportParams = new URLSearchParams();
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  if (customer) exportParams.set("customer", customer);
  if (item_type) exportParams.set("item_type", item_type);
  if (mechanic) exportParams.set("mechanic", mechanic);

  return (
    <div className="page">
      <PageHeader
        title="Report Builder"
        description="Build a custom report from your invoice data with any combination of filters."
        action={
          <a href={`/reports/builder/export?${exportParams.toString()}`}>
            <SecondaryButton type="button" icon="download">
              Export
            </SecondaryButton>
          </a>
        }
      />

      <Card className="mb-6 p-4">
        <form className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
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
          <div className="flex gap-2">
            <PrimaryButton type="submit" icon="search" className="h-9.5 flex-1 xl:flex-none">
              Run report
            </PrimaryButton>
            {(from || to || customer || item_type || mechanic) && (
              <a href="/reports/builder" className="inline-flex h-9.5 items-center rounded-md px-2.5 text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
                Reset
              </a>
            )}
          </div>
        </form>
      </Card>

      <StatStrip
        className="mb-6"
        items={[
          { label: "Total", value: formatAed(total), hint: `${rows.length} line items` },
          { label: "Labour", value: formatAed(byType("labor")) },
          { label: "Parts", value: formatAed(byType("part")) },
          { label: "Services", value: formatAed(byType("service")) },
        ]}
      />

      <Panel title="Results" count={rows.length}>
        {rows.length === 0 ? (
          <EmptyState icon="search" message="No results for these filters." />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Customer</th>
                  <th className={`${thClass} hidden lg:table-cell`}>Vehicle</th>
                  <th className={`${thClass} hidden xl:table-cell`}>Mechanic</th>
                  <th className={thClass}>Item</th>
                  <th className={`${thClass} text-right`}>Qty</th>
                  <th className={`${thClass} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
                    <td className={`${tdClass} whitespace-nowrap text-zinc-500 tabular`}>{formatDate(r.invoice_date)}</td>
                    <td className={`${tdClass} font-medium text-zinc-900`}>{r.customer_name}</td>
                    <td className={`${tdClass} hidden text-zinc-500 lg:table-cell`}>{r.vehicle}</td>
                    <td className={`${tdClass} hidden text-zinc-500 xl:table-cell`}>{r.mechanic_name ?? "—"}</td>
                    <td className={tdClass}>
                      <span className="text-zinc-800">{r.description}</span>
                      <span className="ml-2 rounded bg-zinc-100 px-1.5 py-px text-[11px] font-medium text-zinc-600">{TYPE_LABEL[r.item_type] ?? r.item_type}</span>
                    </td>
                    <td className={`${tdClass} text-right tabular text-zinc-500`}>{r.quantity}</td>
                    <td className={`${tdClass} whitespace-nowrap text-right font-medium tabular text-zinc-900`}>{formatAed(r.line_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 font-semibold text-zinc-900">
                  <td className="px-4 py-3" colSpan={2}>
                    Total
                  </td>
                  <td className="hidden lg:table-cell" />
                  <td className="hidden xl:table-cell" />
                  <td />
                  <td />
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular">{formatAed(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
