"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

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
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      className={className}
      onClick={() => {
        if (!confirm(confirmMessage)) return;
        startTransition(async () => {
          try {
            await action();
            showToast(successMessage, "success");
            if (redirectTo) router.push(redirectTo);
          } catch (err) {
            showToast(err instanceof Error ? err.message : "Something went wrong.", "error");
          }
        });
      }}
    >
      {isPending ? "Deleting…" : children}
    </button>
  );
}
