"use client";

import { useActionState, useState } from "react";
import type { StaffLoginResult } from "@/app/staff/invite-actions";
import { Field, inputClass, labelClass } from "@/components/ui";
import { PrimaryButton, SecondaryButton } from "@/components/ui-buttons";
import { Icon } from "@/components/icons";
import { buildWhatsAppLink } from "@/lib/whatsapp";

type Action = (prev: StaffLoginResult, formData: FormData) => Promise<StaffLoginResult>;

/** Shows the new login once, with copy and WhatsApp buttons. */
function Credentials({ result }: { result: Extract<StaffLoginResult, { ok: true }> }) {
  const [copied, setCopied] = useState(false);
  const site = typeof window !== "undefined" ? window.location.origin : "";
  const text = `Al Bahir Garage system login\n${site}/login\nEmail: ${result.email}\nPassword: ${result.password}\nPlease change it after you sign in (Profile → Change password).`;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
          <Icon name="check-circle" className="h-4 w-4 text-emerald-600" />
          Login ready for {result.name}
        </p>
        <dl className="mt-3 space-y-1.5 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-emerald-800">Email</dt>
            <dd className="font-medium text-emerald-950">{result.email}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-emerald-800">Temporary password</dt>
            <dd className="font-mono text-base font-semibold tracking-wide text-emerald-950">{result.password}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-emerald-800">This password is shown only once. Share it now — they can change it after signing in.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SecondaryButton
          type="button"
          icon={copied ? "check" : "file"}
          onClick={() => {
            navigator.clipboard?.writeText(text).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy details"}
        </SecondaryButton>
        <a
          href={buildWhatsAppLink("", text)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#25D366] px-3.5 text-sm font-medium text-white hover:bg-[#1ebe5b]"
        >
          <Icon name="message" className="h-4 w-4" />
          Send on WhatsApp
        </a>
      </div>
    </div>
  );
}

export function CreateStaffLoginForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<StaffLoginResult, FormData>(action, null);
  if (state?.ok) return <Credentials result={state} />;
  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{state.error}</p>}
      <Field label="Full name" name="full_name" required />
      <Field label="Email (used to sign in)" name="email" type="email" required placeholder="name@example.com" />
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={labelClass}>Access level</span>
          <select name="role" defaultValue="receptionist" className={inputClass}>
            <option value="receptionist">Front desk</option>
            <option value="mechanic">Mechanic</option>
            <option value="owner">Owner (full access)</option>
          </select>
        </label>
        <Field label="Monthly salary (AED)" name="monthly_salary" type="number" step="0.01" />
      </div>
      <p className="text-xs text-zinc-500">A temporary password is created for them. You&apos;ll see it on the next screen to share.</p>
      <PrimaryButton type="submit" className="w-full" icon="user">
        Create login
      </PrimaryButton>
    </form>
  );
}

export function ResetStaffPasswordForm({ action, profileId, name }: { action: Action; profileId: string; name: string }) {
  const [state, formAction] = useActionState<StaffLoginResult, FormData>(action, null);
  if (state?.ok) return <Credentials result={state} />;
  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{state.error}</p>}
      <input type="hidden" name="profile_id" value={profileId} />
      <p className="text-[13px] text-zinc-600">
        {name}&apos;s current password stops working and a new temporary password is created for you to share.
      </p>
      <PrimaryButton type="submit" className="w-full">
        Create new password
      </PrimaryButton>
    </form>
  );
}
