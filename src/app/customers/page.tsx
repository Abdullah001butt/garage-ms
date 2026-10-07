import Link from "next/link";
import { SortHeader, sortRows } from "@/components/SortHeader";
import { BulkBar, BulkSelectProvider, RowCheckbox, SelectAllCheckbox } from "@/components/BulkSelect";
import { BulkLinkButton, BulkRemindButton } from "@/components/BulkActions";
import { PeekButton } from "@/components/Peek";
import { formatAed } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/lib/types";
import { Card, PageHeader, EmptyState, PrimaryButton, SecondaryButton, SegmentedLinks, inputClass, theadClass, thClass } from "@/components/ui";
import { Icon } from "@/components/icons";
import { PlateBadge } from "@/components/PlateBadge";

type CustomerRow = Customer & { vehicles: { id: string; plate_number: string; emirate: string }[] };

type OpenInvoiceRow = {
  customer_id: string;
  discount: number;
  vat_rate: number;
  invoice_items: { quantity: number; unit_price: number }[];
  payments: { amount: number }[];
};

const TYPE_FILTERS = [
  { value: "", label: "All" },
  { value: "company", label: "Companies" },
  { value: "individual", label: "Individuals" },
];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; sort?: string; dir?: string }>;
}) {
  const { q, type, sort = "recent", dir = "desc" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select("*, vehicles(id, plate_number, emirate)")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  }
  if (type === "company" || type === "individual") {
    query = query.eq("customer_type", type);
  }

  const [{ data: customers, error }, { data: openInvoices }, { data: adjustments }] = await Promise.all([
    query.returns<CustomerRow[]>(),
    supabase
      .from("invoices")
      .select("customer_id, discount, vat_rate, invoice_items(quantity, unit_price), payments(amount)")
      .eq("document_type", "invoice")
      .in("status", ["unpaid", "partial"])
      .returns<OpenInvoiceRow[]>(),
    supabase.from("customer_balance_adjustments").select("customer_id, amount").returns<{ customer_id: string; amount: number }[]>(),
  ]);

  const balances = new Map<string, number>();
  for (const inv of openInvoices ?? []) {
    const subtotal = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    const total = subtotal + subtotal * (inv.vat_rate / 100) - inv.discount;
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    balances.set(inv.customer_id, (balances.get(inv.customer_id) ?? 0) + Math.max(total - paid, 0));
  }
  for (const a of adjustments ?? []) {
    balances.set(a.customer_id, (balances.get(a.customer_id) ?? 0) + Number(a.amount));
  }

  // The shared "Walk-in customer" (counter sales) is bookkeeping, not a real customer.
  const rows = sortRows(
    (customers ?? []).filter((c) => !c.is_walk_in),
    (c) => (sort === "name" ? c.name : sort === "balance" ? balances.get(c.id) ?? 0 : sort === "vehicles" ? c.vehicles.length : c.created_at),
    dir
  );
  const sortHref = (field: string, d: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    params.set("sort", field);
    params.set("dir", d);
    return `/customers?${params.toString()}`;
  };
  const targets = rows.map((c) => ({ id: c.id, name: c.name, phone: c.phone, detail: c.phone, message: "" }));
  const filterHref = (value: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (value) params.set("type", value);
    const qs = params.toString();
    return qs ? `/customers?${qs}` : "/customers";
  };

  return (
    <div className="page">
      <PageHeader
        title="Customers"
        description="Individuals and companies, their vehicles and account balances."
        action={
          <>
            <a href="/customers/export">
              <SecondaryButton type="button" icon="download">
                Export
              </SecondaryButton>
            </a>
            <Link href="/customers/new">
              <PrimaryButton type="button">+ Add Customer</PrimaryButton>
            </Link>
          </>
        }
      />

      {error && <p className="mb-4 text-sm text-red-600">Failed to load customers: {error.message}</p>}

      <BulkSelectProvider ids={rows.map((c) => c.id)}>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-200 p-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedLinks
            items={TYPE_FILTERS.map((f) => ({ label: f.label, href: filterHref(f.value), active: (type ?? "") === f.value }))}
          />
          <form className="relative w-full sm:w-72">
            {type && <input type="hidden" name="type" value={type} />}
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input type="text" name="q" defaultValue={q ?? ""} placeholder="Filter by name or phone" className={`${inputClass} pl-8`} />
          </form>
        </div>

        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th className="w-10 pl-4">
                  <SelectAllCheckbox />
                </th>
                <SortHeader label="Customer" field="name" sort={sort} dir={dir} href={sortHref} defaultDir="asc" />
                <th className={`${thClass} hidden md:table-cell`}>Phone</th>
                <SortHeader label="Vehicles" field="vehicles" sort={sort} dir={dir} href={sortHref} className="hidden lg:table-cell" />
                <SortHeader label="Balance" field="balance" sort={sort} dir={dir} href={sortHref} align="right" />
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((customer) => {
                const balance = balances.get(customer.id) ?? 0;
                const isCompany = customer.customer_type === "company";
                const href = `/customers/${customer.id}`;
                return (
                  <tr key={customer.id} className="group border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
                    <td className="w-10 pl-4">
                      <RowCheckbox id={customer.id} label={customer.name} />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={href} className="flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                            isCompany ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          <Icon name={isCompany ? "building" : "user"} className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-zinc-900">{customer.name}</span>
                          <span className="block truncate text-xs text-zinc-500">
                            {isCompany ? "Company" : "Individual"}
                            {customer.city ? ` · ${customer.city}` : ""}
                            <span className="md:hidden"> · {customer.phone}</span>
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-600 tabular md:table-cell">{customer.phone}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {customer.vehicles.length === 0 ? (
                        <span className="text-xs text-zinc-400">No vehicles</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {customer.vehicles.slice(0, 2).map((v) => (
                            <PlateBadge key={v.id} plateNumber={v.plate_number} emirate={v.emirate} />
                          ))}
                          {customer.vehicles.length > 2 && (
                            <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
                              +{customer.vehicles.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular">
                      {balance > 0.01 ? (
                        <span className="font-medium text-red-700">{formatAed(balance)}</span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="pr-3">
                      <span className="flex items-center justify-end gap-0.5">
                        <PeekButton type="customer" id={customer.id} />
                        <Link href={href} aria-label={`Open ${customer.name}`} className="hidden text-zinc-300 group-hover:text-zinc-500 sm:block">
                          <Icon name="chevron-right" className="h-4 w-4" />
                        </Link>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!error && rows.length === 0 && (
          <EmptyState icon="user" message={q || type ? "No customers match these filters." : "No customers yet. Add your first one to get started."} />
        )}
        {rows.length > 0 && (
          <div className="border-t border-zinc-200 bg-zinc-50/60 px-4 py-2 text-xs text-zinc-500">
            {rows.length} customer{rows.length === 1 ? "" : "s"}
          </div>
        )}
      </Card>
      <BulkBar noun="customer">
        <BulkRemindButton
          targets={targets}
          label="WhatsApp message"
          compose="Hi {name}, this is Al Bahir Garage. "
        />
        <BulkLinkButton href="/customers/export" label="Export" />
      </BulkBar>
      </BulkSelectProvider>
    </div>
  );
}
