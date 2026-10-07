import type { ReactNode } from "react";
import { formatWeekdayDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { ShopSettings, CompanyVehicle, ShopHoliday } from "@/lib/types";
import {
  updateShopSettings,
  createCompanyVehicle,
  deleteCompanyVehicle,
  createShopHoliday,
  deleteShopHoliday,
} from "@/app/settings/actions";
import { Card, PageHeader, PrimaryButton, SecondaryButton, Field, PanelEmpty, inputClass, labelClass } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { SlideOver } from "@/components/SlideOver";
import { RowMenu, RowMenuDelete } from "@/components/RowMenu";

const SECTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: "shop", label: "Shop details", icon: "building" },
  { id: "invoicing", label: "Invoice & VAT", icon: "receipt" },
  { id: "reminders", label: "Reminders & reviews", icon: "clock" },
  { id: "booking", label: "Online booking", icon: "calendar" },
  { id: "vehicles", label: "Company vehicles", icon: "car" },
  { id: "holidays", label: "Working calendar", icon: "calendar" },
  { id: "backup", label: "Data backup", icon: "download" },
];

// Section with its title/description on the left and the content on the right.
function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-zinc-200 py-8 first:pt-0 last:border-0">
      <div className="grid gap-6 xl:grid-cols-[16rem_1fr]">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">{description}</p>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: companyVehicles }, { data: holidays }] = await Promise.all([
    supabase.from("shop_settings").select("*").limit(1).maybeSingle<ShopSettings>(),
    supabase.from("company_vehicles").select("*").order("created_at").returns<CompanyVehicle[]>(),
    supabase.from("shop_holidays").select("*").order("holiday_date").returns<ShopHoliday[]>(),
  ]);

  if (!settings) {
    return (
      <div className="page page-narrow">
        <PageHeader title="Settings" />
        <p className="text-sm text-zinc-500">Shop settings row not found. Re-run the phase 5 SQL migration.</p>
      </div>
    );
  }

  const bookingLink = settings.portal_url ? settings.portal_url.replace(/\/portal\/?$/, "/book") : "/book";

  return (
    <div className="page">
      <PageHeader title="Settings" description="Shop details, invoicing defaults and workshop configuration." />

      <div className="grid gap-8 lg:grid-cols-[13rem_1fr]">
        <nav className="hidden lg:block" aria-label="Settings sections">
          <ul className="sticky top-20 space-y-px">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <Icon name={s.icon} className="h-4 w-4 text-zinc-400" />
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          {/* One form for every shop_settings field: the save action writes them all together. */}
          <form action={updateShopSettings.bind(null, settings.id)}>
            <Section id="shop" title="Shop details" description="Your business name and contact details, printed on every invoice, estimate and report.">
              <Card className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                <Field label="Shop name" name="shop_name" defaultValue={settings.shop_name} required className="sm:col-span-2" />
                <Field label="Address" name="address" defaultValue={settings.address ?? ""} className="sm:col-span-2" />
                <Field label="Phone" name="phone" defaultValue={settings.phone ?? ""} />
                <Field label="Fax / alternate phone" name="facsimile" defaultValue={settings.facsimile ?? ""} />
                <Field label="Email" name="email" defaultValue={settings.email ?? ""} />
                <Field label="Website" name="website" defaultValue={settings.website ?? ""} placeholder="http://www.yourdomain.com" />
              </Card>
            </Section>

            <Section id="invoicing" title="Invoice & VAT" description="Tax registration and the wording shown at the bottom of invoices.">
              <Card className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                <Field label="TRN (Tax Registration Number)" name="trn" defaultValue={settings.trn ?? ""} />
                <Field label="VAT rate (%)" name="vat_rate" type="number" step="0.01" defaultValue={settings.vat_rate} />
                <Field label="Payment method note" name="payment_method_note" defaultValue={settings.payment_method_note ?? "Cash Only"} />
                <Field label="Payment instructions (bold line)" name="payment_instructions" defaultValue={settings.payment_instructions ?? ""} />
                <label className="block sm:col-span-2">
                  <span className={labelClass}>Invoice disclaimer</span>
                  <textarea name="invoice_disclaimer" rows={3} defaultValue={settings.invoice_disclaimer ?? ""} className={inputClass} />
                </label>
              </Card>
            </Section>

            <Section
              id="reminders"
              title="Reminders & reviews"
              description="When customers are reminded about their next service, and where happy customers leave a review."
            >
              <Card className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                <Field
                  label="Default service interval (days)"
                  name="default_service_interval_days"
                  type="number"
                  defaultValue={settings.default_service_interval_days}
                />
                <Field label="Customer portal URL" name="portal_url" defaultValue={settings.portal_url ?? ""} placeholder="https://yourdomain.com/portal" />
                <label className="block sm:col-span-2">
                  <span className={labelClass}>Google review link</span>
                  <input
                    type="text"
                    name="google_review_link"
                    defaultValue={settings.google_review_link ?? ""}
                    placeholder="https://g.page/r/xxxxxxxxxxxx/review"
                    className={inputClass}
                  />
                  <span className="mt-1.5 block text-xs text-zinc-500">
                    In Google Business Profile, open &quot;Get more reviews&quot; and copy the short link it gives you.
                  </span>
                </label>
              </Card>
            </Section>

            <div className="sticky bottom-0 z-10 -mx-4 mb-2 flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
              <span className="mr-auto text-xs text-zinc-500">Saves shop details, invoicing and reminder settings together.</span>
              <PrimaryButton type="submit" icon="check">
                Save settings
              </PrimaryButton>
            </div>
          </form>

          <Section id="booking" title="Online booking" description="Share this link on WhatsApp status, Google Business Profile or business cards so customers can request appointments anytime.">
            <Card className="flex items-center gap-3 p-4">
              <Icon name="link" className="h-4 w-4 text-zinc-400" />
              <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-zinc-700">{bookingLink}</code>
            </Card>
          </Section>

          <Section
            id="vehicles"
            title="Company vehicles"
            description="Vehicles the garage owns (parts vans, recovery trucks), so their fuel, tolls and renewals can be tagged on expenses."
          >
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5">
                <p className="text-[13px] font-medium text-zinc-700">{companyVehicles?.length ?? 0} vehicles</p>
                <SlideOver title="Add company vehicle" description="A vehicle owned by the garage." triggerLabel="Add vehicle" variant="secondary">
                  <form action={createCompanyVehicle} className="space-y-4">
                    <Field label="Name" name="name" placeholder="Parts van" required />
                    <Field label="Plate number" name="plate_number" />
                    <Field label="Notes" name="notes" />
                    <PrimaryButton type="submit" className="w-full">
                      Add vehicle
                    </PrimaryButton>
                  </form>
                </SlideOver>
              </div>
              {(companyVehicles?.length ?? 0) === 0 ? (
                <PanelEmpty message="No company vehicles added yet." />
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {companyVehicles!.map((v) => (
                    <li key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500">
                        <Icon name="car" className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900">{v.name}</p>
                        <p className="truncate text-xs text-zinc-500">{[v.plate_number, v.notes].filter(Boolean).join(" · ") || "—"}</p>
                      </div>
                      <RowMenu>
                        <RowMenuDelete action={deleteCompanyVehicle.bind(null, v.id)} confirmMessage={`Remove "${v.name}"?`} successMessage="Vehicle removed." label="Remove" />
                      </RowMenu>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Section>

          <Section id="holidays" title="Working calendar" description="Fridays and official holidays, marked as non-working days for scheduling and attendance.">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5">
                <p className="text-[13px] font-medium text-zinc-700">{holidays?.length ?? 0} non-working days</p>
                <SlideOver title="Add holiday" description="A day the workshop is closed." triggerLabel="Add day" variant="secondary">
                  <form action={createShopHoliday} className="space-y-4">
                    <Field label="Date" name="holiday_date" type="date" required />
                    <Field label="Label" name="label" placeholder="Official holiday" required />
                    <PrimaryButton type="submit" className="w-full">
                      Add holiday
                    </PrimaryButton>
                  </form>
                </SlideOver>
              </div>
              {(holidays?.length ?? 0) === 0 ? (
                <PanelEmpty message="No holidays configured yet." />
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {holidays!.map((h) => (
                    <li key={h.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900">{h.label}</p>
                        <p className="text-xs text-zinc-500">{formatWeekdayDate(h.holiday_date)}</p>
                      </div>
                      <RowMenu>
                        <RowMenuDelete action={deleteShopHoliday.bind(null, h.id)} confirmMessage="Remove this holiday?" successMessage="Holiday removed." label="Remove" />
                      </RowMenu>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Section>

          <Section
            id="backup"
            title="Data backup"
            description="One zip with customers, invoices, expenses, this month's attendance and profit & loss — all as Excel files you keep."
          >
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-[13px] text-zinc-600">Download a copy regularly and keep it somewhere safe.</p>
              <a href="/backup/export">
                <SecondaryButton type="button" icon="download">
                  Download full backup
                </SecondaryButton>
              </a>
            </Card>
          </Section>
        </div>
      </div>
    </div>
  );
}
