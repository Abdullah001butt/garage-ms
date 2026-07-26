import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/lib/types";
import { Card, PageHeader, EmptyState, PrimaryButton, SecondaryButton, inputClass } from "@/components/ui";
import { deleteCustomer } from "@/app/customers/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

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
          <div className="flex flex-wrap gap-2">
            <a href="/customers/export">
              <SecondaryButton type="button">Export Excel</SecondaryButton>
            </a>
            <Link href="/customers/new">
              <PrimaryButton type="button">+ Add Customer</PrimaryButton>
            </Link>
          </div>
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
            <li key={customer.id} className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
              <Link href={`/customers/${customer.id}`} className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 truncate">{customer.name}</p>
                <p className="text-sm text-slate-500">{customer.phone}</p>
              </Link>
              <form action={deleteCustomer.bind(null, customer.id)}>
                <ConfirmSubmitButton
                  confirmMessage={`Delete customer "${customer.name}"? This cannot be undone.`}
                >
                  Delete
                </ConfirmSubmitButton>
              </form>
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
