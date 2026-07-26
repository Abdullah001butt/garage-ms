"use client";

import { useTransition } from "react";
import { useToast } from "@/components/Toast";
import { SecondaryButton } from "@/components/ui";

export function GenerateInsightsButton({ action }: { action: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  return (
    <SecondaryButton
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            await action();
            showToast("Weekly insights generated.", "success");
          } catch (err) {
            showToast(err instanceof Error ? err.message : "Failed to generate insights.", "error");
          }
        });
      }}
    >
      {isPending ? "Generating…" : "Generate This Week's Insights"}
    </SecondaryButton>
  );
}
