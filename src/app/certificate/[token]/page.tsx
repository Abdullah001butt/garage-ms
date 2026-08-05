import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";

type CertificateJob = {
  description: string;
  status: string;
  odometer: number | null;
  created_at: string;
  completed_at: string | null;
};

type CertificateData = {
  plate_number: string;
  emirate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  vin: string | null;
  body_type: string | null;
  owner_name: string;
  customer_since: string;
  jobs: CertificateJob[];
};

export default async function VehicleCertificatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("vehicle_certificate", { p_token: token });
  const certificate = data as CertificateData | null;

  if (!certificate) notFound();

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      <Card className="p-6 md:p-8 print:shadow-none print:border-none">
        <div className="flex items-start justify-between gap-4 border-b-4 border-slate-900 pb-4">
          <div>
            <h1 className="text-xl font-bold uppercase text-slate-400">Vehicle Service History Certificate</h1>
            <div className="mt-3">
              <Image src="/logoalbahir.png" alt="Al Bahir Garage" width={140} height={40} className="h-10 w-auto object-contain" />
            </div>
            <p className="mt-2 text-sm font-bold text-slate-900">AL BAHIR VEHICLES REPAIR LLC</p>
          </div>
          <Badge color="green">✓ Verified Record</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-slate-400">Vehicle</p>
            <p className="font-medium text-slate-900">
              {[certificate.year, certificate.make, certificate.model].filter(Boolean).join(" ") || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Plate Number</p>
            <p className="font-medium text-slate-900">
              {certificate.plate_number} ({certificate.emirate})
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Color</p>
            <p className="font-medium text-slate-900">{certificate.color ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Body Type</p>
            <p className="font-medium text-slate-900">{certificate.body_type ?? "—"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-slate-400">Registered Owner on File</p>
            <p className="font-medium text-slate-900">{certificate.owner_name}</p>
          </div>
        </div>

        <h2 className="mt-6 mb-2 text-sm font-semibold text-slate-700">
          Verified Service History ({certificate.jobs.length} completed job{certificate.jobs.length === 1 ? "" : "s"})
        </h2>
        <div className="border border-slate-300">
          {certificate.jobs.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">No completed service records yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {certificate.jobs.map((job, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{job.description}</p>
                    {job.odometer && <p className="text-xs text-slate-500">Odometer: {job.odometer} KM</p>}
                  </div>
                  <p className="shrink-0 text-xs text-slate-500">
                    {new Date(job.completed_at ?? job.created_at).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 text-[10px] text-slate-500">
          This certificate reflects service records held by Al Bahir Vehicles Repair LLC only and does not include
          work performed elsewhere. Generated from a secure, unguessable link tied to this specific vehicle.
        </p>
      </Card>

      <div className="mt-4 flex justify-center print:hidden">
        <PrintButton />
      </div>
    </div>
  );
}
