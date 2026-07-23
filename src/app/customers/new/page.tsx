import Link from "next/link";
import { createCustomerWithVehicle } from "@/app/customers/actions";
import { Card, PageHeader, PrimaryButton, Field } from "@/components/ui";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      <Link href="/customers" className="text-sm text-indigo-600 hover:underline">
        &larr; Back to customers
      </Link>
      <PageHeader title="Add Customer" />

      <form action={createCustomerWithVehicle} className="space-y-6">
        <Card className="p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Customer details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full name" name="name" required />
            <Field label="Phone" name="phone" required />
            <Field label="Email" name="email" type="email" />
            <Field label="Address" name="address" />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Vehicle (optional — can add later)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Plate number" name="plate_number" />
            <Field label="Make" name="make" placeholder="Toyota" />
            <Field label="Model" name="model" placeholder="Corolla" />
            <Field label="Year" name="year" type="number" />
            <Field label="Color" name="color" />
          </div>
        </Card>

        <PrimaryButton type="submit">Save Customer</PrimaryButton>
      </form>
    </div>
  );
}
