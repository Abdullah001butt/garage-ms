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
        <form action={updateWithId} className="grid grid-cols-2 gap-4">
          <Field label="Shop Name" name="shop_name" defaultValue={settings.shop_name} required className="col-span-2" />
          <Field label="TRN (Tax Registration Number)" name="trn" defaultValue={settings.trn ?? ""} />
          <Field label="VAT Rate (%)" name="vat_rate" type="number" step="0.01" defaultValue={settings.vat_rate} />
          <Field label="Address" name="address" defaultValue={settings.address ?? ""} className="col-span-2" />
          <Field label="Phone" name="phone" defaultValue={settings.phone ?? ""} />
          <Field
            label="Customer Portal URL"
            name="portal_url"
            defaultValue={settings.portal_url ?? ""}
            placeholder="https://yourdomain.com/portal"
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
