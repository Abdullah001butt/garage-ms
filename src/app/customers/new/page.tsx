import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createCustomerWithVehicle } from "@/app/customers/actions";
import { PageHeader } from "@/components/ui";
import { Steps, Step } from "@/components/Steps";
import { CustomerFields } from "@/components/CustomerFields";
import { VehicleFields } from "@/components/VehicleFields";

export default async function NewCustomerPage() {
  const supabase = await createClient();
  const { data: vehicles } = await supabase.from("vehicles").select("make, model");

  const uniqueMakes = [...new Set((vehicles ?? []).map((v) => v.make).filter(Boolean))];
  const uniqueModels = [...new Set((vehicles ?? []).map((v) => v.model).filter(Boolean))];

  return (
    <div className="page">
      <Link href="/customers" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
        ← Back to customers
      </Link>
      <PageHeader title="Add Customer" description="Three quick steps: who they are, their car, then save." />

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

      <Steps
        action={createCustomerWithVehicle}
        submitLabel="Save customer"
        review
        steps={[
          { id: "customer", title: "Customer", description: "Individual or company, with a mobile number for WhatsApp updates." },
          { id: "vehicle", title: "Vehicle", description: "Optional — leave blank and press Next to add a vehicle later." },
          { id: "review", title: "Review & save", description: "Check the details, then save." },
        ]}
      >
        <Step id="customer" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CustomerFields />
        </Step>
        <Step id="vehicle" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <VehicleFields makeListId="vehicle-makes" modelListId="vehicle-models" />
        </Step>
        <Step id="review">
          <p className="text-[13px] text-zinc-500">After saving you&apos;ll land on the customer&apos;s page, where you can open a job card straight away.</p>
        </Step>
      </Steps>
    </div>
  );
}
