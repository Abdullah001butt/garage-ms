"use client";

import { useActionState } from "react";
import Image from "next/image";
import { bookAppointment } from "@/app/book/actions";
import { Card } from "@/components/ui";

type BookResult = { error?: string; success?: boolean } | null;

async function submitBooking(_prev: BookResult, formData: FormData): Promise<BookResult> {
  return bookAppointment(formData);
}

export default function BookPage() {
  const [state, formAction, isPending] = useActionState<BookResult, FormData>(submitBooking, null);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logoalbahir.png"
            alt="Al Bahir Garage"
            width={320}
            height={68}
            className="h-16 w-auto object-contain mb-2"
            priority
          />
          <p className="text-sm text-slate-500">Book a service appointment anytime</p>
        </div>

        {state?.success ? (
          <Card className="p-6 text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="font-semibold text-slate-900 mb-1">Appointment Requested!</p>
            <p className="text-sm text-slate-500">
              We&apos;ve received your booking request. Our team will confirm shortly. Thank you for
              choosing Al Bahir Garage.
            </p>
          </Card>
        ) : (
          <Card className="p-5">
            <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {state?.error && (
                <p className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {state.error}
                </p>
              )}

              <label className="block col-span-2">
                <span className="block text-sm font-medium text-slate-700 mb-1">
                  Your Name <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="block col-span-2">
                <span className="block text-sm font-medium text-slate-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  name="phone"
                  required
                  placeholder="e.g. 0501234567"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">Plate Number</span>
                <input
                  type="text"
                  name="plate"
                  placeholder="e.g. DXB-12345"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">Make / Model</span>
                <input
                  type="text"
                  name="make"
                  placeholder="e.g. Toyota"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                />
                <input
                  type="text"
                  name="model"
                  placeholder="e.g. Corolla"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">
                  Preferred Date <span className="text-red-500">*</span>
                </span>
                <input
                  type="date"
                  name="date"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">
                  Preferred Time <span className="text-red-500">*</span>
                </span>
                <input
                  type="time"
                  name="time"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="block col-span-2">
                <span className="block text-sm font-medium text-slate-700 mb-1">
                  What do you need done?
                </span>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="e.g. Oil change, brake noise, AC not cooling..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <button
                type="submit"
                disabled={isPending}
                className="col-span-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
              >
                {isPending ? "Booking..." : "Request Appointment"}
              </button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
