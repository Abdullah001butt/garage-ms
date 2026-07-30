"use client";

import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/components/Toast";

export function useActionMutation(
  action: () => Promise<void>,
  options?: { successMessage?: string; errorMessage?: string; onSuccess?: () => void }
) {
  const { showToast } = useToast();

  return useMutation({
    mutationFn: action,
    onSuccess: () => {
      if (options?.successMessage) showToast(options.successMessage, "success");
      options?.onSuccess?.();
    },
    onError: (err: unknown) => {
      showToast(err instanceof Error ? err.message : options?.errorMessage ?? "Something went wrong.", "error");
    },
  });
}
