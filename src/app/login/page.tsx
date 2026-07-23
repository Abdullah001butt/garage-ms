import { signIn } from "@/app/login/actions";
import { Card, PrimaryButton, Field } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
            AB
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 leading-none">Al Bahir Garage</p>
            <p className="text-xs text-slate-500 mt-0.5">Staff sign in</p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <form action={signIn} className="space-y-4">
          <Field label="Email" name="email" type="email" required />
          <Field label="Password" name="password" type="password" required />
          <PrimaryButton type="submit" className="w-full justify-center">
            Sign In
          </PrimaryButton>
        </form>
      </Card>
    </div>
  );
}
