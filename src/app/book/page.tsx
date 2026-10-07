"use client";

import { useActionState, useState } from "react";
import { bookAppointment } from "@/app/book/actions";
import { Card, inputClass, labelClass } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { PublicShell, SHOP_CONTACT } from "@/components/PublicShell";

type BookResult = { error?: string; success?: boolean } | null;

async function submitBooking(_prev: BookResult, formData: FormData): Promise<BookResult> {
  return bookAppointment(formData);
}

const QUICK_SERVICES = ["Oil & filter change", "AC service", "Brakes", "Battery", "Tyres", "General inspection", "Engine check light"];

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  { icon: "clock", title: "Quick confirmation", text: "We call or WhatsApp you to confirm the time." },
  { icon: "file", title: "Estimate on request", text: "Ask for a written estimate before any work starts." },
  { icon: "shield", title: "History on file", text: "Every visit is recorded, so your car's service history is always available." },
];

function todayInUae() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
}

export default function BookPage() {
  const [state, formAction, isPending] = useActionState<BookResult, FormData>(submitBooking, null);
  const [notes, setNotes] = useState("");

  function toggleService(service: string) {
    setNotes((current) => {
      const parts = current.split(", ").filter(Boolean);
      return parts.includes(service) ? parts.filter((p) => p !== service).join(", ") : [...parts, service].join(", ");
    });
  }

  return (
    <PublicShell active="book">
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_20rem] lg:py-14">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Book a service</h1>
          <p className="mt-2 text-sm text-zinc-500">Pick a time that suits you — day or night. Our team confirms every request.</p>

          {state?.success ? (
            <Card className="mt-6 p-8 text-center">
              <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
                <Icon name="check" className="h-6 w-6" />
              </span>
              <p className="text-lg font-semibold text-zinc-900">Request received</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-zinc-500">
                Thank you for choosing Al Bahir Garage. We&apos;ll contact you shortly to confirm your appointment.
              </p>
              <a
                href={SHOP_CONTACT.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                <Icon name="message" className="h-4 w-4 text-emerald-600" />
                Questions? WhatsApp us
              </a>
            </Card>
          ) : (
            <Card className="mt-6 p-5 sm:p-6">
              <form action={formAction} className="space-y-6">
                {state?.error && (
                  <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    <Icon name="alert" className="mt-0.5 h-4 w-4 text-red-600" />
                    {state.error}
                  </p>
                )}

                <fieldset className="space-y-4">
                  <legend className="mb-3 text-[13px] font-semibold text-zinc-900">Your details</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelClass}>
                        Full name <span className="text-brand-600">*</span>
                      </span>
                      <input type="text" name="name" required autoComplete="name" className={inputClass} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>
                        Mobile number <span className="text-brand-600">*</span>
                      </span>
                      <input type="tel" name="phone" required autoComplete="tel" placeholder="e.g. 050 123 4567" className={inputClass} />
                    </label>
                  </div>
                </fieldset>

                <fieldset className="space-y-4 border-t border-zinc-100 pt-5">
                  <legend className="mb-3 text-[13px] font-semibold text-zinc-900">Your vehicle</legend>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="block">
                      <span className={labelClass}>Plate number</span>
                      <input type="text" name="plate" placeholder="e.g. A 12345" className={inputClass} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Make</span>
                      <input type="text" name="make" placeholder="e.g. Toyota" className={inputClass} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Model</span>
                      <input type="text" name="model" placeholder="e.g. Corolla" className={inputClass} />
                    </label>
                  </div>
                </fieldset>

                <fieldset className="space-y-4 border-t border-zinc-100 pt-5">
                  <legend className="mb-3 text-[13px] font-semibold text-zinc-900">What do you need?</legend>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_SERVICES.map((service) => {
                      const on = notes.split(", ").includes(service);
                      return (
                        <button
                          key={service}
                          type="button"
                          onClick={() => toggleService(service)}
                          aria-pressed={on}
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors ${
                            on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                          }`}
                        >
                          {on && <Icon name="check" className="h-3 w-3" />}
                          {service}
                        </button>
                      );
                    })}
                  </div>
                  <label className="block">
                    <span className={labelClass}>Details (optional)</span>
                    <textarea
                      name="notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Noise when braking, AC not cooling…"
                      className={inputClass}
                    />
                  </label>
                </fieldset>

                <fieldset className="space-y-4 border-t border-zinc-100 pt-5">
                  <legend className="mb-3 text-[13px] font-semibold text-zinc-900">Preferred time</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelClass}>
                        Date <span className="text-brand-600">*</span>
                      </span>
                      <input type="date" name="date" required min={todayInUae()} className={inputClass} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>
                        Time <span className="text-brand-600">*</span>
                      </span>
                      <input type="time" name="time" required className={inputClass} />
                    </label>
                  </div>
                </fieldset>

                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.08)] hover:bg-brand-700 disabled:opacity-60"
                >
                  {isPending ? "Sending request…" : "Request appointment"}
                  {!isPending && <Icon name="arrow-right" className="h-4 w-4" />}
                </button>
              </form>
            </Card>
          )}
        </div>

        <aside className="space-y-4 lg:pt-16">
          {PROMISES.map((p) => (
            <div key={p.title} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600">
                <Icon name={p.icon} className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-zinc-900">{p.title}</p>
                <p className="text-[13px] text-zinc-500">{p.text}</p>
              </div>
            </div>
          ))}
          <Card className="p-4">
            <p className="text-[13px] font-medium text-zinc-900">Prefer to call?</p>
            <a href={SHOP_CONTACT.phoneHref} className="mt-1 block text-lg font-semibold tracking-tight text-zinc-900 tabular hover:underline">
              {SHOP_CONTACT.phone}
            </a>
            <p className="text-xs text-zinc-500">{SHOP_CONTACT.address}</p>
          </Card>
        </aside>
      </div>
    </PublicShell>
  );
}
