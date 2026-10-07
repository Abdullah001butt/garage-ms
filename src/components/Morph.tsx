import { ViewTransition, type ReactNode } from "react";

/**
 * Marks an element that exists on two pages (a plate on the job board and on the job page, an invoice
 * number in the list and as the page title). During navigation the browser glides one into the other.
 */
export function Morph({ name, children }: { name: string; children: ReactNode }) {
  return (
    <ViewTransition name={name} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}
