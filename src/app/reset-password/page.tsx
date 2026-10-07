"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui";

/** Set a new password — reached from the reset email or from the profile menu while signed in. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setSaving(true);
    const { error: err } = await createClient().auth.updateUser({ password });
    setSaving(false);
    if (err) return setError(err.message);
    router.replace("/today?password=changed");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <Image src="/logoalbahir.png" alt="Al Bahir Garage" width={160} height={48} className="mx-auto h-12 w-auto object-contain" />
        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-zinc-900">Set a new password</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Choose something you&apos;ll remember — at least 8 characters.</p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{error}</p>}
            <Field label="New password" name="password" type="password" required />
            <Field label="Type it again" name="confirm" type="password" required />
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save new password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
