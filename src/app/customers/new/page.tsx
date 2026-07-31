import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createCustomerWithVehicle } from "@/app/customers/actions";
import { Card, PageHeader, PrimaryButton } from "@/components/ui";
import { CustomerFields } from "@/components/CustomerFields";
import { VehicleFields } from "@/components/VehicleFields";

export default async function NewCustomerPage() {
  const supabase = await createClient();
  const { data: vehicles } = await supabase.from("vehicles").select("make, model");

  const uniqueMakes = [...new Set((vehicles ?? []).map((v) => v.make).filter(Boolean))];
  const uniqueModels = [...new Set((vehicles ?? []).map((v) => v.model).filter(Boolean))];

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      <Link href="/customers" className="text-sm text-indigo-600 hover:underline">
        &larr; Back to customers
      </Link>
      <PageHeader title="Add Customer" description="Choose Individual or Company, then add their details and vehicle." />

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

      <form action={createCustomerWithVehicle} className="space-y-6">
        <Card className="p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Customer Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CustomerFields />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Vehicle Details (optional — can add more later)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <VehicleFields makeListId="vehicle-makes" modelListId="vehicle-models" />
          </div>
        </Card>

        <PrimaryButton type="submit">Save Customer</PrimaryButton>
      </form>
    </div>
  );
}
