import { formatDate } from "@/lib/format";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { Icon } from "@/components/icons";
import { PlateBadge } from "@/components/PlateBadge";
import { PublicShell, SHOP_CONTACT } from "@/components/PublicShell";
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

  const jobs = [...certificate.jobs].sort(
    (x, y) => new Date(y.completed_at ?? y.created_at).getTime() - new Date(x.completed_at ?? x.created_at).getTime()
  );
  const firstVisit = jobs.length ? jobs[jobs.length - 1].created_at : null;
  const lastVisit = jobs.length ? jobs[0].completed_at ?? jobs[0].created_at : null;
  const lastOdometer = jobs.find((j) => j.odometer)?.odometer ?? null;
  const certificateId = token.replace(/-/g, "").slice(0, 10).toUpperCase();

  const facts: [string, string][] = [
    ["Vehicle", [certificate.year, certificate.make, certificate.model].filter(Boolean).join(" ") || "—"],
    ["Colour", certificate.color ?? "—"],
    ["Body type", certificate.body_type ?? "—"],
    ["VIN / chassis", certificate.vin ?? "—"],
    ["Registered owner", certificate.owner_name],
    ["Customer since", formatDate(certificate.customer_since)],
  ];

  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 print:max-w-none print:p-0">
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          <p className="text-sm text-zinc-500">Shared securely by Al Bahir Garage</p>
          <PrintButton label="Print / save PDF" />
        </div>

        <Card className="overflow-hidden print:border-none print:shadow-none">
          <div className="flex flex-col gap-4 border-b border-zinc-200 bg-zinc-50/70 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Image src="/logoalbahir.png" alt="Al Bahir Garage" width={180} height={40} className="h-9 w-auto object-contain" />
              <h1 className="mt-3 text-lg font-semibold tracking-tight text-zinc-900">Vehicle Service History Certificate</h1>
              <p className="text-xs text-zinc-500">
                Certificate {certificateId} · Issued {formatDate(new Date())}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 py-1 pl-1 pr-3 sm:self-auto">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Icon name="check" className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-semibold text-emerald-800">Verified workshop record</span>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <PlateBadge plateNumber={certificate.plate_number} emirate={certificate.emirate} size="lg" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              {facts.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs font-medium text-zinc-500">{label}</dt>
                  <dd className="mt-0.5 break-words text-sm text-zinc-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid grid-cols-2 border-y border-zinc-200 sm:grid-cols-4">
            {[
              ["Completed services", String(jobs.length)],
              ["First visit", formatDate(firstVisit)],
              ["Most recent service", formatDate(lastVisit)],
              ["Last recorded odometer", lastOdometer ? `${Number(lastOdometer).toLocaleString("en-US")} km` : "—"],
            ].map(([label, value], i) => (
              <div key={label} className={`px-6 py-4 ${i > 0 ? "sm:border-l sm:border-zinc-200" : ""} ${i > 1 ? "border-t border-zinc-200 sm:border-t-0" : ""} ${i % 2 === 1 ? "border-l border-zinc-200" : ""}`}>
                <p className="text-xs font-medium text-zinc-500">{label}</p>
                <p className="mt-1 text-lg font-semibold tracking-tight text-zinc-900 tabular">{value}</p>
              </div>
            ))}
          </div>

          <div className="px-6 py-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">Service record</h2>
            {jobs.length === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-300 px-3 py-8 text-center text-sm text-zinc-400">No completed service records yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Work carried out</th>
                    <th className="py-2 text-right font-medium">Odometer</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job, i) => (
                    <tr key={i} className="border-b border-zinc-100 last:border-0">
                      <td className="whitespace-nowrap py-2.5 pr-4 text-zinc-500 tabular">{formatDate(job.completed_at ?? job.created_at)}</td>
                      <td className="py-2.5 pr-4 text-zinc-900">{job.description}</td>
                      <td className="whitespace-nowrap py-2.5 text-right text-zinc-600 tabular">
                        {job.odometer ? `${Number(job.odometer).toLocaleString("en-US")} km` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="border-t border-zinc-200 bg-zinc-50/70 px-6 py-4 text-[11px] leading-relaxed text-zinc-500">
            This certificate lists service work recorded by {SHOP_CONTACT.name} only and does not include work done elsewhere.
            It was generated from a private link tied to this vehicle. For verification call {SHOP_CONTACT.phone}.
          </div>
        </Card>
      </div>
    </PublicShell>
  );
}
