import Link from "next/link";
import { createVehicleEvaluation } from "@/app/evaluations/actions";
import { Card, PageHeader, PrimaryButton, Field, labelClass, inputClass } from "@/components/ui";
import { DEFAULT_INSPECTION_PARTICULARS } from "@/lib/evaluation";
import { CarDiagramMarkerInput } from "@/components/CarDiagramMarkerInput";

export default function NewEvaluationPage() {
  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Link href="/evaluations" className="text-sm text-indigo-600 hover:underline">
        &larr; Back to evaluations
      </Link>
      <PageHeader title="New Vehicle Evaluation Report" description="Fill this once — the printable report and reference number are generated automatically." />

      <form action={createVehicleEvaluation} className="space-y-6">
        <Card className="p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Customer Detail</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Customer / Company Name" name="customer_name" required placeholder="e.g. Indonesian Consulate General" />
            <Field label="Location" name="customer_location" placeholder="e.g. Dubai, United Arab Emirates" />
            <Field label="Phone / Mobile" name="customer_phone" placeholder="971-56-754-9898" />
            <Field label="Reference (contact person)" name="customer_ref" placeholder="e.g. Mr. Cucu" />
            <Field label="Evaluation Date" name="evaluation_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Description</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Make and Model" name="make_model" required placeholder="MERCEDES-BENZ E300" />
            <Field label="Registration No." name="registration_no" placeholder="CC-2195(CONSULATE DXB)" />
            <Field label="Year of Manufacture" name="year_of_manufacture" placeholder="2012-2013" />
            <Field label="Color" name="color" placeholder="BLACK" />
            <Field label="Mileage / ODO Reading" name="mileage_odo" placeholder="152725 KM" />
            <Field label="Chassis No." name="chassis_no" placeholder="WDDHFSEB9DA670760" />
            <Field label="Ownership (1st, 2nd, etc.)" name="ownership" placeholder="N/A" />
            <Field label="Engine No." name="engine_no" placeholder="27295232071339" />
            <Field label="Date of Last Service" name="date_of_last_service" placeholder="N/A" />
            <Field label="Type of Vehicle" name="type_of_vehicle" placeholder="SALOON" />
            <Field label="Accident History" name="accident_history" placeholder="N/A" />
            <Field label="No. of Doors" name="no_of_doors" placeholder="4 + RR LIFTGATE" />
            <Field label="Service History" name="service_history" placeholder="N/A" />
            <Field label="No. of Cylinders" name="no_of_cylinders" placeholder="6" />
            <Field label="Any Warranty Remaining" name="warranty_remaining" placeholder="N/A" />
            <Field label="Transmission / Shift Select" name="transmission" placeholder="Automatic" />
            <Field label="Empty Weight" name="empty_weight" placeholder="1576 K" />
            <Field label="Specification / Origin" name="specification_origin" placeholder="EU, GERMANY" />
            <Field label="Gross Vehicle Weight" name="gross_weight" placeholder="2750 K" />
            <Field label="Remote" name="remote" placeholder="YES, PUSH START" />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Damage Diagram</h2>
          <CarDiagramMarkerInput />
        </Card>

        <Card className="p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
            The Inspection Reveals the Following
          </h2>
          <div className="space-y-3">
            {DEFAULT_INSPECTION_PARTICULARS.map((particular, i) => (
              <div key={particular} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 sm:items-center border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <input type="hidden" name="inspection_particular" value={particular} />
                <p className="text-sm font-medium text-slate-700">{particular}</p>
                <div className="flex gap-3">
                  {[
                    { value: "good", label: "Good" },
                    { value: "fair", label: "Fair" },
                    { value: "poor", label: "Poor" },
                    { value: "na", label: "N/A" },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-1 text-xs text-slate-600">
                      <input
                        type="radio"
                        name={`inspection_condition_${i}`}
                        value={opt.value}
                        defaultChecked={i === 0 ? opt.value === "good" : opt.value === "na"}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  name="inspection_remarks"
                  placeholder="Remarks"
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Valuation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Estimated Value — Min (AED)" name="estimated_value_min" type="number" placeholder="15000" />
            <Field label="Estimated Value — Max (AED)" name="estimated_value_max" type="number" placeholder="18000" />
            <Field label="Name of Valuator" name="valuator_name" placeholder="Muhammad Akmal Butt" />
            <Field label="Fee Charged (AED)" name="fee_amount" type="number" placeholder="300" />
          </div>
        </Card>

        <PrimaryButton type="submit">Save & Generate Report</PrimaryButton>
      </form>
    </div>
  );
}
