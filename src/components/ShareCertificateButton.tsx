"use client";

import { useState } from "react";
import { SecondaryButton } from "@/components/ui";

export function ShareCertificateButton({ shareToken }: { shareToken: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const url = `${window.location.origin}/certificate/${shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <SecondaryButton type="button" icon={copied ? "check" : "link"} onClick={handleClick}>
      {copied ? "Link copied" : "Share certificate"}
    </SecondaryButton>
  );
}
