"use client";

import { usePathname } from "next/navigation";
import { ViewTransition, type ReactNode } from "react";

/** Fades the page body in when the address changes. Saves, refreshes and filter changes stay still. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="page-in" exit="page-out" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
