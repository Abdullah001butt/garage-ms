"use client";

import { createContext, useContext } from "react";

// Lets items inside a portalled RowMenu reach the table row they act on.
export type RowMenuContextValue = { close: () => void; getAnchor: () => HTMLElement | null };
export const RowMenuContext = createContext<RowMenuContextValue | null>(null);

export function useRowMenu() {
  return useContext(RowMenuContext);
}
