import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/lib/types";
import { Card, PageHeader, EmptyState, PrimaryButton, inputClass } from "@/components/ui";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data: customers, error } = await query;

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Customers"
        description="Customer records and their linked vehicles."
        action={
          <Link href="/customers/new">
            <PrimaryButton type="button">+ Add Customer</PrimaryButton>
          </Link>
        }
      />

      <form className="mb-6">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or phone..."
          className={inputClass}
        />
      </form>

      {error && (
        <p className="text-red-600 text-sm mb-4">
          Failed to load customers: {error.message}
        </p>
      )}

      <Card className="overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {(customers as Customer[] | null)?.map((customer) => (
            <li key={customer.id}>
              <Link
                href={`/customers/${customer.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">{customer.name}</p>
                  <p className="text-sm text-slate-500">{customer.phone}</p>
                </div>
                <span className="text-slate-400">&rarr;</span>
              </Link>
            </li>
          ))}
        </ul>
        {!error && customers?.length === 0 && (
          <EmptyState message="No customers yet. Add your first one to get started." />
        )}
      </Card>
    </div>
  );
}
