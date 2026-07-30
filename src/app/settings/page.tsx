import { createClient } from "@/lib/supabase/server";
import type { ShopSettings, CompanyVehicle, ShopHoliday } from "@/lib/types";
import {
  updateShopSettings,
  createCompanyVehicle,
  deleteCompanyVehicle,
  createShopHoliday,
  deleteShopHoliday,
} from "@/app/settings/actions";
import { Card, PageHeader, PrimaryButton, SecondaryButton, Field, EmptyState } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: companyVehicles }, { data: holidays }] = await Promise.all([
    supabase.from("shop_settings").select("*").limit(1).maybeSingle<ShopSettings>(),
    supabase.from("company_vehicles").select("*").order("created_at").returns<CompanyVehicle[]>(),
    supabase.from("shop_holidays").select("*").order("holiday_date").returns<ShopHoliday[]>(),
  ]);

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
          <Field label="Email" name="email" defaultValue={settings.email ?? ""} />
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
            <span className="block text-sm font-medium text-slate-700 mb-1">
              Google Review Link
            </span>
            <p className="text-xs text-slate-500 mb-1">
              In Google Business Profile, go to &quot;Get more reviews&quot; and copy the short link
              it gives you (e.g. g.page/r/.../review).
            </p>
            <input
              type="text"
              name="google_review_link"
              defaultValue={settings.google_review_link ?? ""}
              placeholder="https://g.page/r/xxxxxxxxxxxx/review"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="col-span-2">
            <PrimaryButton type="submit">Save Settings</PrimaryButton>
          </div>
        </form>
      </Card>

      <Card className="p-5 mt-6">
        <p className="text-sm font-semibold text-slate-700 mb-1">Public Booking Page</p>
        <p className="text-xs text-slate-500 mb-2">
          Share this link with customers (WhatsApp status, Google Business profile, business card)
          so they can request an appointment anytime, even outside business hours:
        </p>
        <p className="text-sm font-mono text-indigo-600 bg-indigo-50 rounded-md px-3 py-2 break-all">
          {settings.portal_url ? settings.portal_url.replace(/\/portal\/?$/, "/book") : "/book"}
        </p>
      </Card>

      <Card className="p-5 mt-6">
        <p className="text-sm font-semibold text-slate-700 mb-3">Company Vehicles</p>
        <p className="text-xs text-slate-500 mb-3">
          Vehicles your garage owns (parts-run vans, recovery trucks) — tag their running costs
          (fuel, RTA renewal, tolls) separately when recording an expense.
        </p>
        <ul className="divide-y divide-slate-100 mb-3">
          {companyVehicles?.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-slate-900 truncate">{v.name}</p>
                {v.plate_number && <p className="text-xs text-slate-500">{v.plate_number}</p>}
              </div>
              <ConfirmSubmitButton
                action={deleteCompanyVehicle.bind(null, v.id)}
                confirmMessage={`Remove "${v.name}"?`}
                successMessage="Removed."
              >
                Remove
              </ConfirmSubmitButton>
            </li>
          ))}
          {companyVehicles?.length === 0 && <EmptyState message="No company vehicles added yet." />}
        </ul>
        <form action={createCompanyVehicle} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Field label="Name" name="name" placeholder="Parts Van" required />
          <Field label="Plate Number" name="plate_number" />
          <Field label="Notes" name="notes" />
          <div className="sm:col-span-3">
            <SecondaryButton type="submit">Add Company Vehicle</SecondaryButton>
          </div>
        </form>
      </Card>

      <Card className="p-5 mt-6">
        <p className="text-sm font-semibold text-slate-700 mb-3">Shop Working Calendar</p>
        <p className="text-xs text-slate-500 mb-3">
          Mark Fridays and official holidays as non-working days for scheduling and attendance context.
        </p>
        <ul className="divide-y divide-slate-100 mb-3">
          {holidays?.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="text-slate-700">
                {new Date(h.holiday_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} — {h.label}
              </span>
              <ConfirmSubmitButton
                action={deleteShopHoliday.bind(null, h.id)}
                confirmMessage="Remove this holiday?"
                successMessage="Removed."
              >
                Remove
              </ConfirmSubmitButton>
            </li>
          ))}
          {holidays?.length === 0 && <EmptyState message="No holidays configured yet." />}
        </ul>
        <form action={createShopHoliday} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Field label="Date" name="holiday_date" type="date" required />
          <Field label="Label" name="label" placeholder="Official Holiday" required className="sm:col-span-2" />
          <div className="sm:col-span-3">
            <SecondaryButton type="submit">Add Holiday</SecondaryButton>
          </div>
        </form>
      </Card>

      <Card className="p-5 mt-6">
        <p className="text-sm font-semibold text-slate-700 mb-1">Full Data Backup</p>
        <p className="text-xs text-slate-500 mb-4">
          Download a single zip with customers, invoices, expenses, this month&apos;s attendance,
          and this month&apos;s profit &amp; loss — all as Excel files, independent of Supabase.
        </p>
        <a href="/backup/export">
          <SecondaryButton type="button">Download Full Backup</SecondaryButton>
        </a>
      </Card>
    </div>
  );
}
