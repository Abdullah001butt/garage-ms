export function formatInvoiceNumber(invoiceNumber: number | null | undefined, createdAt: string): string | null {
  if (!invoiceNumber) return null;
  const year = new Date(createdAt).getFullYear();
  return `INV-${year}-${String(invoiceNumber).padStart(4, "0")}`;
}
