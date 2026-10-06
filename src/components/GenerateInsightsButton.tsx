"use client";

import { useActionMutation } from "@/hooks/useActionMutation";
import { SecondaryButton } from "@/components/ui";

export function GenerateInsightsButton({ action }: { action: () => Promise<void> }) {
  const mutation = useActionMutation(action, {
    successMessage: "Weekly insights generated.",
    errorMessage: "Failed to generate insights.",
  });

  return (
    <SecondaryButton type="button" icon="sparkles" className="h-8 px-2.5 text-[13px]" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
      {mutation.isPending ? "Generating…" : "Generate summary"}
    </SecondaryButton>
  );
}
