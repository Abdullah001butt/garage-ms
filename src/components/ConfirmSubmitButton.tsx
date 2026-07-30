"use client";

import { useRouter } from "next/navigation";
import { useActionMutation } from "@/hooks/useActionMutation";

export function ConfirmSubmitButton({
  action,
  confirmMessage,
  successMessage = "Deleted successfully.",
  redirectTo,
  className = "text-xs text-red-500 hover:underline disabled:opacity-50",
  children,
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  successMessage?: string;
  redirectTo?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const mutation = useActionMutation(action, {
    successMessage,
    onSuccess: () => {
      if (redirectTo) router.push(redirectTo);
    },
  });

  return (
    <button
      type="button"
      disabled={mutation.isPending}
      className={className}
      onClick={() => {
        if (!confirm(confirmMessage)) return;
        mutation.mutate();
      }}
    >
      {mutation.isPending ? "Deleting…" : children}
    </button>
  );
}
