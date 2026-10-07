import Link from "next/link";
import { formatAed, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { formatInvoiceNumber } from "@/lib/invoice-number";
import { PageHeader, Panel, PanelEmpty, SecondaryButton, tdClass, thClass, theadClass } from "@/components/ui";
import { StatStrip, pctChange } from "@/components/report-ui";
import { DateRangePicker } from "@/components/DateRangePicker";
import { isoBounds, resolveRange } from "@/lib/date-range";

type InvoiceRow = {
  id: string;
  invoice_number: number | null;
  created_at: string;
  vat_rate: number;
  customers: { name: string; trn_number: string | null } | null;
  invoice_items: { quantity: number; unit_price: number }[];
};

export default async function VatReportPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const range = resolveRange(await searchParams, "quarter");
  const now = isoBounds(range.from, range.to);
  const prev = isoBounds(range.prevFrom, range.prevTo);

  const supabase = await createClient();
  const select = "id, invoice_number, created_at, vat_rate, customers(name, trn_number), invoice_items(quantity, unit_price)";
  const [{ data: invoices, error }, { data: previous }] = await Promise.all([
    supabase.from("invoices").select(select).eq("document_type", "invoice").gte("created_at", now.start).lte("created_at", now.end).order("created_at").returns<InvoiceRow[]>(),
    supabase.from("invoices").select(select).eq("document_type", "invoice").gte("created_at", prev.start).lte("created_at", prev.end).returns<InvoiceRow[]>(),
  ]);

  const summarise = (list: InvoiceRow[]) =>
    list.map((inv) => {
      const subtotal = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
      const vat = subtotal * (inv.vat_rate / 100);
      return { ...inv, subtotal, vat, total: subtotal + vat };
    });
  const rows = summarise(invoices ?? []);
  const prevRows = summarise(previous ?? []);
  const sum = (list: typeof rows, key: "subtotal" | "vat" | "total") => list.reduce((s, r) => s + r[key], 0);

  const net = sum(rows, "subtotal");
  const vat = sum(rows, "vat");
  const total = sum(rows, "total");

  return (
    <div className="page">
      <PageHeader
        title="VAT Report"
        description={`Output tax on invoices · ${range.label}`}
        action={
          <>
            <DateRangePicker range={range} basePath="/reports/vat" presets={["month", "last-month", "quarter", "year"]}>
              <a href={`/reports/vat/export?start=${range.from}&end=${range.to}`}>
                <SecondaryButton type="button" icon="download">
                  Export
                </SecondaryButton>
              </a>
            </DateRangePicker>
          </>
        }
      />

      {error && <p className="mb-4 text-sm text-red-600">Failed to load: {error.message}</p>}

      <StatStrip
        className="mb-6"
        items={[
          { label: "Net sales (excl. VAT)", value: formatAed(net), delta: pctChange(net, sum(prevRows, "subtotal")), deltaLabel: range.compareLabel },
          { label: "VAT collected", value: formatAed(vat), delta: pctChange(vat, sum(prevRows, "vat")), deltaLabel: range.compareLabel },
          { label: "Total invoiced", value: formatAed(total), tone: "positive", hint: "Including VAT" },
          { label: "Invoices", value: String(rows.length), hint: `${prevRows.length} in previous period` },
        ]}
      />

      <Panel title="Invoices in period" count={rows.length}>
        {rows.length === 0 ? (
          <PanelEmpty message="No invoices in this period." />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={`${thClass} hidden sm:table-cell`}>Date</th>
                  <th className={`${thClass} hidden sm:table-cell`}>Invoice</th>
                  <th className={thClass}>Customer</th>
                  <th className={`${thClass} hidden md:table-cell`}>Customer TRN</th>
                  <th className={`${thClass} hidden text-right sm:table-cell`}>Net</th>
                  <th className={`${thClass} hidden text-right sm:table-cell`}>VAT</th>
                  <th className={`${thClass} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50/60">
                    <td className={`${tdClass} hidden whitespace-nowrap text-zinc-500 tabular sm:table-cell`}>{formatDate(r.created_at)}</td>
                    <td className={`${tdClass} hidden whitespace-nowrap sm:table-cell`}>
                      <Link href={`/invoices/${r.id}`} className="font-mono text-[13px] font-medium text-zinc-900 hover:underline">
                        {formatInvoiceNumber(r.invoice_number, r.created_at) ?? "Invoice"}
                      </Link>
                    </td>
                    <td className={`${tdClass} font-medium text-zinc-900`}>
                      {r.customers?.name ?? "—"}
                      <p className="text-xs font-normal text-zinc-500 sm:hidden">
                        {formatInvoiceNumber(r.invoice_number, r.created_at)} · {formatDate(r.created_at)}
                      </p>
                    </td>
                    <td className={`${tdClass} hidden font-mono text-xs text-zinc-500 md:table-cell`}>{r.customers?.trn_number || "—"}</td>
                    <td className={`${tdClass} hidden whitespace-nowrap text-right tabular sm:table-cell`}>{formatAed(r.subtotal)}</td>
                    <td className={`${tdClass} hidden whitespace-nowrap text-right tabular sm:table-cell`}>{formatAed(r.vat)}</td>
                    <td className={`${tdClass} whitespace-nowrap text-right font-medium text-zinc-900 tabular`}>
                      {formatAed(r.total)}
                      <p className="text-xs font-normal text-zinc-500 sm:hidden">VAT {formatAed(r.vat)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 font-semibold text-zinc-900">
                  <td className="hidden px-4 py-3 sm:table-cell" colSpan={2}>
                    Total · {rows.length} invoices
                  </td>
                  <td className="px-4 py-3">
                    <span className="sm:hidden">Total</span>
                  </td>
                  <td className="hidden md:table-cell" />
                  <td className="hidden whitespace-nowrap px-4 py-3 text-right tabular sm:table-cell">{formatAed(net)}</td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-right tabular sm:table-cell">{formatAed(vat)}</td>
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
