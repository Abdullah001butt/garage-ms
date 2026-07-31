import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { VehicleEvaluation, ShopSettings } from "@/lib/types";
import { PageHeader, SecondaryButton, Card } from "@/components/ui";
import { CarDiagramView } from "@/components/CarDiagramView";
import { DownloadEvaluationPdfButton } from "@/components/DownloadEvaluationPdfButton";

const CONDITION_LABEL: Record<string, string> = { good: "Good", fair: "Fair", poor: "Poor", na: "N/A" };

function descRow(label: string, value: string | null) {
  return (
    <div className="flex border-b border-slate-200 last:border-0">
      <div className="w-1/2 border-r border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-500">{label}</div>
      <div className="w-1/2 px-2 py-1.5 text-xs font-bold text-slate-900">{value || "N/A"}</div>
    </div>
  );
}

export default async function EvaluationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: evaluation }, { data: settings }] = await Promise.all([
    supabase.from("vehicle_evaluations").select("*").eq("id", id).maybeSingle<VehicleEvaluation>(),
    supabase.from("shop_settings").select("*").limit(1).maybeSingle<ShopSettings>(),
  ]);

  if (!evaluation) notFound();

  const items = evaluation.inspection_items ?? [];

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Vehicle Evaluation Report"
        description={evaluation.ref_number}
        action={
          <div className="flex gap-2">
            <Link href="/evaluations">
              <SecondaryButton type="button">Back</SecondaryButton>
            </Link>
            <DownloadEvaluationPdfButton refNumber={evaluation.ref_number} />
          </div>
        }
      />

      <Card className="p-6 md:p-8" id="evaluation-printable">
        <div className="flex items-start justify-between gap-4 border-b-4 border-slate-900 pb-4">
          <div>
            <h1 className="text-2xl font-bold uppercase text-slate-400">Vehicle Evaluation Report</h1>
            <div className="mt-3 flex items-center gap-3">
              <Image src="/logoalbahir.png" alt="Al Bahir Garage" width={140} height={40} className="h-10 w-auto object-contain" />
            </div>
            <p className="mt-2 text-sm font-bold text-slate-900">{settings?.shop_name ?? "AL BAHIR VEHICLES REPAIR LLC"}</p>
            <p className="text-xs text-slate-600">
              {settings?.website && <>[{settings.website}] </>}
              {settings?.phone && <>Telephone [{settings.phone}]</>}
            </p>
            {settings?.address && <p className="text-xs text-slate-600">[{settings.address}]</p>}
          </div>
          <div className="shrink-0 text-right text-xs text-slate-600">
            <p>
              <span className="font-semibold">Evaluation Ref.:</span> #[{evaluation.ref_number}]
            </p>
            <p>
              <span className="font-semibold">Date:</span> {new Date(evaluation.evaluation_date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
            <div className="mt-3 text-left">
              <p className="font-semibold text-slate-900">CUSTOMER DETAIL:</p>
              <p>[{evaluation.customer_name}]</p>
              {evaluation.customer_location && <p>[{evaluation.customer_location}]</p>}
              {evaluation.customer_phone && <p>Phone/Mobile [{evaluation.customer_phone}]</p>}
              {evaluation.customer_ref && <p>Ref.: [{evaluation.customer_ref}]</p>}
            </div>
          </div>
        </div>

        <div className="mt-4 border border-slate-300">
          <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">DESCRIPTION</div>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            <div>
              {descRow("Make and Model:", evaluation.make_model)}
              {descRow("Year of Manufacture:", evaluation.year_of_manufacture)}
              {descRow("Mileage/ODO Reading:", evaluation.mileage_odo)}
              {descRow("Ownership (1st, 2nd, etc.):", evaluation.ownership)}
              {descRow("Date of Last Service:", evaluation.date_of_last_service)}
              {descRow("Accident History:", evaluation.accident_history)}
              {descRow("Service History:", evaluation.service_history)}
              {descRow("Any Warranty Remaining:", evaluation.warranty_remaining)}
              {descRow("Empty Weight:", evaluation.empty_weight)}
              {descRow("Gross Vehicle Weight:", evaluation.gross_weight)}
            </div>
            <div>
              {descRow("Registration No.:", evaluation.registration_no)}
              {descRow("Color:", evaluation.color)}
              {descRow("Chassis No.:", evaluation.chassis_no)}
              {descRow("Engine No.:", evaluation.engine_no)}
              {descRow("Type of Vehicle:", evaluation.type_of_vehicle)}
              {descRow("No. of Doors:", evaluation.no_of_doors)}
              {descRow("No. of Cylinders:", evaluation.no_of_cylinders)}
              {descRow("Transmission/Shift Select:", evaluation.transmission)}
              {descRow("Specification/Origin:", evaluation.specification_origin)}
              {descRow("Remote:", evaluation.remote)}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
          <div className="hidden sm:block rounded-md border border-slate-300 p-2">
            <CarDiagramView markers={evaluation.diagram_markers ?? []} />
          </div>

          <div className="border border-slate-300">
            <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
              THE INSPECTION REVEALS THE FOLLOWING:
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-slate-600">
                  <th className="px-2 py-1 text-left">Particulars</th>
                  <th className="px-2 py-1 text-center">Condition</th>
                  <th className="px-2 py-1 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const flagged = item.condition === "poor" || item.condition === "fair";
                  return (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className={`px-2 py-1 ${flagged ? "font-bold text-red-600" : "text-slate-700"}`}>{item.particular}</td>
                      <td className="px-2 py-1 text-center">{CONDITION_LABEL[item.condition]}</td>
                      <td className={`px-2 py-1 ${flagged ? "font-bold text-red-600" : "text-slate-700"}`}>{item.remarks || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row justify-between gap-4 border-t border-slate-300 pt-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Estimated True and Fair Market Value of Vehicle:</p>
            <p className="text-lg font-bold text-slate-900">
              AED {evaluation.estimated_value_min?.toLocaleString() ?? "—"} - {evaluation.estimated_value_max?.toLocaleString() ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Name of Valuator:</p>
            <p className="text-lg font-bold text-slate-900">{evaluation.valuator_name || "—"}</p>
          </div>
        </div>

        <p className="mt-4 text-[10px] text-slate-500">
          {settings?.shop_name ?? "Al Bahir Vehicles Repair LLC"} shall not be held responsible/liable for any hidden,
          existing, future, or unforeseen mechanical, electrical, or performance-related issues in the vehicle after
          this evaluation. Fee of <span className="font-semibold text-slate-700">AED {evaluation.fee_amount?.toLocaleString() ?? "0"}/-</span> has
          been charged for this service.
        </p>
      </Card>
    </div>
  );
}
