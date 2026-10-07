/**
 * One place for invoice money maths, so every page agrees:
 * total = (items + VAT) − discount; balance = total − credit notes − (payments − refunds).
 */
export type InvoiceMoneyInput = {
  vat_rate: number | null;
  discount: number | null;
  invoice_items: { quantity: number; unit_price: number }[];
  payments?: { amount: number }[] | null;
  credit_notes?: { amount: number }[] | null;
};

export function invoiceFigures(inv: InvoiceMoneyInput) {
  const subtotal = inv.invoice_items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
  const vat = subtotal * (Number(inv.vat_rate ?? 5) / 100);
  const total = subtotal + vat - Number(inv.discount ?? 0);
  const paid = (inv.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const credited = (inv.credit_notes ?? []).reduce((s, c) => s + Number(c.amount), 0);
  const balance = Math.max(total - credited - paid, 0);
  return { subtotal, vat, total, paid, credited, balance };
}

export function formatCreditNoteNumber(n: number | null | undefined, createdAt: string) {
  if (!n) return "Credit note";
  return `CN-${new Date(createdAt).getFullYear()}-${String(n).padStart(4, "0")}`;
}
