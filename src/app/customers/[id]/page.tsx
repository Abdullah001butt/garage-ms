import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Customer, Vehicle, CustomerBalanceAdjustment } from "@/lib/types";
import {
  addVehicle,
  updateVehicleServiceInterval,
  updateCustomer,
  deleteCustomer,
  updateVehicle,
  deleteVehicle,
  addBalanceAdjustment,
  deleteBalanceAdjustment,
} from "@/app/customers/actions";
import { Card, PageHeader, EmptyState, Field, Badge, SecondaryButton, PrimaryButton } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { getActiveWarrantiesForVehicles } from "@/lib/warranty";
import { PlateBadge } from "@/components/PlateBadge";
import { CustomerFields } from "@/components/CustomerFields";
import { VehicleFields } from "@/components/VehicleFields";

type CustomerInvoiceRow = {
  id: string;
  discount: number;
  vat_rate: number;
  invoice_items: { quantity: number; unit_price: number }[];
  payments: { amount: number }[];
};

function registrationBadge(expiryDate: string | null) {
  if (!expiryDate) return null;
  const daysLeft = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) {
    return <Badge color="red">Registration expired</Badge>;
  }
  if (daysLeft <= 30) {
    return <Badge color="amber">Registration due {new Date(expiryDate).toLocaleDateString()}</Badge>;
  }
  return null;
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: customer }, { data: vehicles }, { data: invoices }, { data: adjustments }, { data: allVehicles }] =
    await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single<Customer>(),
      supabase
        .from("vehicles")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .returns<Vehicle[]>(),
      supabase
        .from("invoices")
        .select("id, discount, vat_rate, invoice_items(quantity, unit_price), payments(amount)")
        .eq("customer_id", id)
        .eq("document_type", "invoice")
        .in("status", ["unpaid", "partial"])
        .returns<CustomerInvoiceRow[]>(),
      supabase
        .from("customer_balance_adjustments")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .returns<CustomerBalanceAdjustment[]>(),
      supabase.from("vehicles").select("make, model"),
    ]);

  const uniqueMakes = [...new Set((allVehicles ?? []).map((v) => v.make).filter(Boolean))];
  const uniqueModels = [...new Set((allVehicles ?? []).map((v) => v.model).filter(Boolean))];

  if (!customer) {
    notFound();
  }

  const warrantyMap = await getActiveWarrantiesForVehicles((vehicles ?? []).map((v) => v.id));

  const invoiceBalance = (invoices ?? []).reduce((sum, inv) => {
    const subtotal = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    const total = subtotal + subtotal * (inv.vat_rate / 100) - inv.discount;
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    return sum + Math.max(total - paid, 0);
  }, 0);
  const adjustmentBalance = (adjustments ?? []).reduce((s, a) => s + Number(a.amount), 0);
  const accountBalance = invoiceBalance + adjustmentBalance;

  const addVehicleWithId = addVehicle.bind(null, id);
  const updateCustomerWithId = updateCustomer.bind(null, id);
  const deleteCustomerWithId = deleteCustomer.bind(null, id);
  const addBalanceAdjustmentWithId = addBalanceAdjustment.bind(null, id);

  const detailLine = [
    customer.customer_type === "company" ? "🏢 Company" : "👤 Individual",
    customer.phone,
    customer.landline,
    customer.email,
    customer.address,
    customer.city,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Link href="/customers" className="text-sm text-indigo-600 hover:underline">
        &larr; Back to customers
      </Link>

      <PageHeader
        title={customer.name}
        description={detailLine}
        action={
          <div className="flex flex-wrap gap-2">
            {customer.customer_type === "company" && vehicles && vehicles.length > 1 && (
              <Link href={`/customers/${id}/fleet`}>
                <SecondaryButton type="button">Fleet Overview</SecondaryButton>
              </Link>
            )}
            <Link href={`/customers/${id}/statement`}>
              <SecondaryButton type="button">Statement of Account</SecondaryButton>
            </Link>
          </div>
        }
      />

      {(customer.trn_number || customer.representative || customer.reference_name) && (
        <p className="text-xs text-slate-500 mb-6 -mt-4">
          {[
            customer.trn_number && `TRN: ${customer.trn_number}`,
            customer.representative && `Representative: ${customer.representative}`,
            customer.reference_name && `Reference: ${customer.reference_name}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      <datalist id="vehicle-makes">
        {uniqueMakes.map((m) => (
          <option key={m} value={m as string} />
        ))}
      </datalist>
      <datalist id="vehicle-models">
        {uniqueModels.map((m) => (
          <option key={m} value={m as string} />
        ))}
      </datalist>

      <Card className="relative mb-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-xs text-slate-500">Account Balance</p>
            <p className={`text-2xl font-bold ${accountBalance > 0 ? "text-red-600" : "text-emerald-600"}`}>
              AED {accountBalance.toFixed(2)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Unpaid invoices: AED {invoiceBalance.toFixed(2)}
              {adjustmentBalance !== 0 &&
                ` · Manual adjustments: ${adjustmentBalance > 0 ? "+" : ""}AED ${adjustmentBalance.toFixed(2)}`}
            </p>
          </div>
          <details>
            <summary className="cursor-pointer text-xs text-indigo-600 hover:underline">
              + Add balance adjustment
            </summary>
            <form
              action={addBalanceAdjustmentWithId}
              className="absolute right-4 z-10 mt-2 w-72 space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-md"
            >
              <Field
                label="Amount (AED, use negative for credit/payment)"
                name="amount"
                type="number"
                step="0.01"
                required
              />
              <Field label="Note" name="note" placeholder="e.g. Old balance carried forward" required />
              <PrimaryButton type="submit" className="w-full justify-center">
                Add Adjustment
              </PrimaryButton>
            </form>
          </details>
        </div>
        {adjustments && adjustments.length > 0 && (
          <ul className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
            {adjustments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                <span className="text-slate-500">
                  {new Date(a.created_at).toLocaleDateString()} · {a.note}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={a.amount > 0 ? "font-medium text-red-600" : "font-medium text-emerald-600"}>
                    {a.amount > 0 ? "+" : ""}AED {Number(a.amount).toFixed(2)}
                  </span>
                  <ConfirmSubmitButton
                    action={deleteBalanceAdjustment.bind(null, id, a.id)}
                    confirmMessage="Remove this balance adjustment?"
                    successMessage="Adjustment removed."
                  >
                    Remove
                  </ConfirmSubmitButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-6 p-4">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Edit customer details
          </summary>
          <form action={updateCustomerWithId} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <CustomerFields customer={customer} lockType />
            <div className="col-span-2">
              <SecondaryButton type="submit">Save Changes</SecondaryButton>
            </div>
          </form>
          <div className="mt-3">
            <ConfirmSubmitButton
              action={deleteCustomerWithId}
              confirmMessage={`Delete customer "${customer.name}" and all their records? This cannot be undone.`}
              successMessage="Customer deleted."
              redirectTo="/customers"
            >
              Delete Customer
            </ConfirmSubmitButton>
          </div>
        </details>
      </Card>

      <h2 className="text-sm font-semibold text-slate-700 mb-3">Vehicles</h2>
      <Card className="mb-6 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {vehicles?.map((vehicle) => {
            const warranties = warrantyMap.get(vehicle.id) ?? [];
            return (
              <li key={vehicle.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <PlateBadge plateNumber={vehicle.plate_number} emirate={vehicle.emirate} />
                    {(vehicle.make || vehicle.model) && (
                      <span className="font-medium text-slate-900">
                        {[vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {[vehicle.year, vehicle.color, vehicle.body_type].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {warranties.length > 0 && <Badge color="green">Under Warranty</Badge>}
                    {registrationBadge(vehicle.registration_expiry_date)}
                  </div>
                  {warranties.length > 0 && (
                    <p className="text-xs text-emerald-600 mt-1">
                      🛡 {warranties.map((w) => w.description).join(", ")} — until{" "}
                      {warranties[0].until.toLocaleDateString()}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <Link
                      href={`/vehicles/${vehicle.id}/qr`}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      View QR Code &rarr;
                    </Link>
                    <Link
                      href={`/vehicles/${vehicle.id}/passport`}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Vehicle Passport &rarr;
                    </Link>
                    <form
                      action={updateVehicleServiceInterval.bind(null, id, vehicle.id)}
                      className="flex items-center gap-1"
                    >
                      <span className="text-xs text-slate-400">Service every</span>
                      <input
                        type="number"
                        name="service_interval_days"
                        defaultValue={vehicle.service_interval_days ?? ""}
                        placeholder="90"
                        className="w-14 rounded border border-slate-300 px-1 py-0.5 text-xs"
                      />
                      <span className="text-xs text-slate-400">days</span>
                      <button type="submit" className="text-xs text-indigo-600 hover:underline">
                        Save
                      </button>
                    </form>
                    <details className="inline-block">
                      <summary className="cursor-pointer text-xs text-slate-500 hover:underline">
                        Edit vehicle
                      </summary>
                      <form
                        action={updateVehicle.bind(null, id, vehicle.id)}
                        className="mt-2 grid grid-cols-2 gap-2 w-80"
                      >
                        <VehicleFields vehicle={vehicle} makeListId="vehicle-makes" modelListId="vehicle-models" required />
                        <button
                          type="submit"
                          className="col-span-2 rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100"
                        >
                          Save Vehicle
                        </button>
                      </form>
                    </details>
                    <ConfirmSubmitButton
                      action={deleteVehicle.bind(null, id, vehicle.id)}
                      confirmMessage={`Delete vehicle "${vehicle.plate_number}"? This cannot be undone.`}
                      successMessage="Vehicle deleted."
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {vehicles?.length === 0 && <EmptyState message="No vehicles on file yet." />}
      </Card>

      <Card className="p-4">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            + Add a vehicle
          </summary>
          <form action={addVehicleWithId} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <VehicleFields makeListId="vehicle-makes" modelListId="vehicle-models" required />
            <div className="col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
              >
                Add Vehicle
              </button>
            </div>
          </form>
        </details>
      </Card>
    </div>
  );
}
