import type { SupplierEntry } from "@/lib/types";

/** What we owe each supplier: purchases on credit minus payments made. */
export function supplierBalances(entries: Pick<SupplierEntry, "supplier_id" | "kind" | "amount">[]) {
  const balances = new Map<string, number>();
  for (const e of entries) {
    const sign = e.kind === "purchase" ? 1 : -1;
    balances.set(e.supplier_id, (balances.get(e.supplier_id) ?? 0) + sign * Number(e.amount));
  }
  return balances;
}
