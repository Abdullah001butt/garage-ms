import Image from "next/image";
import { signIn } from "@/app/login/actions";
import { PrimaryButton, Field, Alert } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

// Turn raw auth/network errors into something staff can act on.
function friendlyError(error: string) {
  const e = error.toLowerCase();
  if (e.includes("fetch failed") || e.includes("network") || e.includes("failed to fetch")) {
    return "We can't reach the database right now. Please try again in a minute — if it keeps happening, the database may be paused.";
  }
  if (e.includes("invalid login") || e.includes("invalid credentials")) {
    return "That email and password don't match. Please check and try again.";
  }
  return error;
}

const HIGHLIGHTS: { icon: IconName; text: string }[] = [
  { icon: "wrench", text: "Job cards from check-in to handover" },
  { icon: "receipt", text: "VAT invoices, payments and statements" },
  { icon: "building", text: "Fleet accounts for corporate customers" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-600/25 blur-3xl" />

        <div className="relative">
          <span className="inline-flex rounded-md bg-white px-3 py-2">
            <Image src="/logoalbahir.png" alt="Al Bahir Garage" width={220} height={48} className="h-8 w-auto object-contain" priority />
          </span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            The workshop, the front desk and the books — in one place.
          </h1>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="flex items-center gap-3 text-sm text-zinc-300">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white">
                  <Icon name={h.icon} className="h-4 w-4" />
                </span>
                {h.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-zinc-500">Al Bahir Vehicles Repair LLC · New Industrial Area 2, Ajman, UAE</p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Image
            src="/logoalbahir.png"
            alt="Al Bahir Garage"
            width={220}
            height={48}
            className="mb-8 h-10 w-auto object-contain lg:hidden"
            priority
          />
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Sign in</h2>
          <p className="mt-1.5 text-sm text-zinc-500">Use your staff account to continue.</p>

          {error && (
            <Alert tone="danger" className="mt-6">
              {friendlyError(error)}
            </Alert>
          )}

          <form action={signIn} className="mt-6 space-y-4">
            <Field label="Email" name="email" type="email" required placeholder="name@albahirgarage.com" />
            <Field label="Password" name="password" type="password" required />
            <PrimaryButton type="submit" className="w-full">
              Sign in
            </PrimaryButton>
          </form>

          <p className="mt-8 text-xs text-zinc-400">Staff accounts are created by the shop owner. Ask them if you need access.</p>
        </div>
      </div>
    </div>
  );
}
