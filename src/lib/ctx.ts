/** What a right-clickable row carries in its `data-ctx` attribute (JSON). */
export type CtxData =
  | { t: "job"; id: string; status: "pending" | "in_progress" | "completed"; plate?: string; title?: string; customer?: string; customerId?: string; phone?: string; invoiced?: boolean }
  | { t: "invoice"; id: string; doc: "invoice" | "estimate"; number: string; status?: string; balance?: number; customer?: string; phone?: string }
  | { t: "customer"; id: string; name: string; phone?: string }
  | { t: "part"; id: string; name: string; sku?: string | null };

/** Builds the attribute for a row, so pages don't hand-write JSON. */
export const ctxAttr = (d: CtxData) => ({ "data-ctx": JSON.stringify(d) });
