"use client";

import { useActionMutation } from "@/hooks/useActionMutation";
import { SecondaryButton } from "@/components/ui";

export function GenerateInsightsButton({ action }: { action: () => Promise<void> }) {
  const mutation = useActionMutation(action, {
    successMessage: "Weekly insights generated.",
    errorMessage: "Failed to generate insights.",
  });

  return (
    <SecondaryButton type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
      {mutation.isPending ? "Generating…" : "Generate This Week's Insights"}
    </SecondaryButton>
  );
}
