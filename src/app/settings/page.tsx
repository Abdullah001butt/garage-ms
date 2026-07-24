import { createClient } from "@/lib/supabase/server";
import type { ShopSettings } from "@/lib/types";
import { updateShopSettings } from "@/app/settings/actions";
import { Card, PageHeader, PrimaryButton, Field } from "@/components/ui";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("shop_settings")
    .select("*")
    .limit(1)
    .maybeSingle<ShopSettings>();

  if (!settings) {
    return (
      <div className="mx-auto max-w-2xl p-6 md:p-8">
        <PageHeader title="Settings" />
        <p className="text-sm text-slate-500">
          Shop settings row not found. Re-run the phase 5 SQL migration.
        </p>
      </div>
    );
  }

  const updateWithId = updateShopSettings.bind(null, settings.id);

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      <PageHeader title="Settings" description="Shop details shown on invoices and estimates." />
      <Card className="p-5">
        <form action={updateWithId} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Shop Name" name="shop_name" defaultValue={settings.shop_name} required className="col-span-2" />
          <Field label="TRN (Tax Registration Number)" name="trn" defaultValue={settings.trn ?? ""} />
          <Field label="VAT Rate (%)" name="vat_rate" type="number" step="0.01" defaultValue={settings.vat_rate} />
          <Field label="Address" name="address" defaultValue={settings.address ?? ""} className="col-span-2" />
          <Field label="Phone" name="phone" defaultValue={settings.phone ?? ""} />
          <Field label="Facsimile / Alt Phone" name="facsimile" defaultValue={settings.facsimile ?? ""} />
          <Field label="Email" name="email" type="email" defaultValue={settings.email ?? ""} />
          <Field label="Website" name="website" defaultValue={settings.website ?? ""} placeholder="http://www.yourdomain.com" />
          <Field
            label="Customer Portal URL"
            name="portal_url"
            defaultValue={settings.portal_url ?? ""}
            placeholder="https://yourdomain.com/portal"
            className="col-span-2"
          />
          <Field
            label="Payment Method Note"
            name="payment_method_note"
            defaultValue={settings.payment_method_note ?? "Cash Only"}
          />
          <Field
            label="Payment Instructions (bold line on invoice)"
            name="payment_instructions"
            defaultValue={settings.payment_instructions ?? ""}
          />
          <label className="block col-span-2">
            <span className="block text-sm font-medium text-slate-700 mb-1">Invoice Disclaimer</span>
            <textarea
              name="invoice_disclaimer"
              rows={2}
              defaultValue={settings.invoice_disclaimer ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <Field
            label="Default Service Interval (days)"
            name="default_service_interval_days"
            type="number"
            defaultValue={settings.default_service_interval_days}
            className="col-span-2"
          />
          <div className="col-span-2">
            <PrimaryButton type="submit">Save Settings</PrimaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
