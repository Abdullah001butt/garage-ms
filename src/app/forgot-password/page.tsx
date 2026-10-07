"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui";
import { Icon } from "@/components/icons";

/** Sends a password-reset link. The link opens /auth/callback, then /reset-password. */
export default function ForgotPasswordPage() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setState("sending");
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (err) {
      setError(err.message.includes("rate") ? "Too many requests — wait a minute and try again." : err.message);
      setState("error");
    } else {
      setState("sent");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <Image src="/logoalbahir.png" alt="Al Bahir Garage" width={160} height={48} className="mx-auto h-12 w-auto object-contain" />
        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          {state === "sent" ? (
            <div className="text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Icon name="mail" className="h-5 w-5" />
              </span>
              <h1 className="mt-4 text-lg font-semibold text-zinc-900">Check your email</h1>
              <p className="mt-1.5 text-[13px] text-zinc-500">If that email has an account, a link to set a new password is on its way. Check spam too.</p>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-zinc-900">Forgot your password?</h1>
              <p className="mt-1 text-[13px] text-zinc-500">Enter your email and we&apos;ll send you a link to set a new one. Or ask the owner to reset it for you.</p>
              <form onSubmit={submit} className="mt-5 space-y-4">
                {state === "error" && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{error}</p>}
                <Field label="Email" name="email" type="email" required />
                <button
                  type="submit"
                  disabled={state === "sending"}
                  className="inline-flex h-10 w-full items-center justify-center rounded-md bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {state === "sending" ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          )}
        </div>
        <p className="mt-5 text-center text-[13px]">
          <Link href="/login" className="font-medium text-zinc-500 hover:text-zinc-900">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
