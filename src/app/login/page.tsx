import Image from "next/image";
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
        <div className="flex flex-col items-center mb-6">
          <Image src="/logo.png" alt="Al Bahir Garage" width={160} height={64} className="h-16 w-auto object-contain mb-2" priority />
          <p className="text-xs text-slate-500">Staff sign in</p>
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
