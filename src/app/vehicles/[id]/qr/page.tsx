import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, SecondaryButton } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";

type VehicleWithCustomer = {
  id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  customer_id: string;
  customers: { name: string; phone: string } | null;
};

export default async function VehicleQrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: vehicle }, { data: settings }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, plate_number, make, model, customer_id, customers(name, phone)")
      .eq("id", id)
      .single<VehicleWithCustomer>(),
    supabase.from("shop_settings").select("portal_url").maybeSingle(),
  ]);

  if (!vehicle || !vehicle.customers) {
    notFound();
  }

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const baseUrl = (
    settings?.portal_url?.replace(/\/portal\/?$/, "").replace(/\/+$/, "") || `${proto}://${host}`
  );

  const portalUrl = `${baseUrl}/portal?phone=${encodeURIComponent(
    vehicle.customers.phone
  )}&plate=${encodeURIComponent(vehicle.plate_number)}`;

  const qrDataUrl = await QRCode.toDataURL(portalUrl, {
    width: 320,
    margin: 1,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  return (
    <div className="mx-auto max-w-md p-6 md:p-8">
      <Link
        href={`/customers/${vehicle.customer_id}`}
        className="text-sm text-indigo-600 hover:underline print:hidden"
      >
        &larr; Back to customer
      </Link>
      <PageHeader title="Vehicle QR Code" description="Scan to check service status instantly." />

      <Card className="p-6 text-center print:shadow-none print:border-none">
        <img src={qrDataUrl} alt={`QR code for ${vehicle.plate_number}`} className="mx-auto mb-4" />
        <p className="text-lg font-semibold text-slate-900">{vehicle.plate_number}</p>
        <p className="text-sm text-slate-500">
          {[vehicle.make, vehicle.model].filter(Boolean).join(" ")}
        </p>
        <p className="text-sm text-slate-500 mt-1">{vehicle.customers.name}</p>
      </Card>

      <div className="mt-4 flex gap-2 print:hidden">
        <PrintButton />
        <a href={qrDataUrl} download={`qr-${vehicle.plate_number}.png`}>
          <SecondaryButton type="button">Download PNG</SecondaryButton>
        </a>
      </div>

      <p className="mt-4 text-xs text-slate-400 print:hidden break-all">{portalUrl}</p>
    </div>
  );
}
