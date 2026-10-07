import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { formatInvoiceNumber } from "@/lib/invoice-number";
import { applyBodyRow, applyTotalRow, startSheet, statusCell, CURRENCY_FORMAT, DATE_FORMAT, type SheetColumn } from "@/lib/xlsx-style";

type InvoiceRow = {
  id: string;
  invoice_number: number | null;
  created_at: string;
  status: string;
  discount: number;
  vat_rate: number;
  customers: { name: string; phone: string } | null;
  job_cards: { description: string; vehicles: { plate_number: string } | null } | null;
  invoice_items: { quantity: number; unit_price: number }[];
  payments: { amount: number }[];
};

const STATUS: Record<string, { label: string; tone: "positive" | "warning" | "negative" }> = {
  paid: { label: "Paid", tone: "positive" },
  partial: { label: "Part paid", tone: "warning" },
  unpaid: { label: "Unpaid", tone: "negative" },
};

/** All invoices, or only `ids` when exporting a selection. */
export async function buildInvoicesWorkbook(ids?: string[]) {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, created_at, status, discount, vat_rate, customers(name, phone), job_cards(description, vehicles(plate_number)), invoice_items(quantity, unit_price), payments(amount)"
    )
    .eq("document_type", "invoice")
    .order("created_at", { ascending: false });
  if (ids?.length) query = query.in("id", ids);
  const { data: invoices } = await query.returns<InvoiceRow[]>();

  const workbook = new ExcelJS.Workbook();
  const columns: SheetColumn[] = [
    { header: "Invoice", key: "number", width: 16 },
    { header: "Date", key: "date", width: 13, numFmt: DATE_FORMAT },
    { header: "Customer", key: "customer", width: 28 },
    { header: "Phone", key: "phone", width: 15 },
    { header: "Vehicle", key: "vehicle", width: 12 },
    { header: "Work", key: "job", width: 34 },
    { header: "Net", key: "subtotal", width: 14, numFmt: CURRENCY_FORMAT },
    { header: "VAT", key: "vat", width: 12, numFmt: CURRENCY_FORMAT },
    { header: "Discount", key: "discount", width: 12, numFmt: CURRENCY_FORMAT },
    { header: "Total", key: "total", width: 14, numFmt: CURRENCY_FORMAT },
    { header: "Paid", key: "paid", width: 14, numFmt: CURRENCY_FORMAT },
    { header: "Balance", key: "balance", width: 14, numFmt: CURRENCY_FORMAT },
    { header: "Status", key: "status", width: 11, align: "center" },
  ];
  const { sheet } = startSheet(workbook, "Invoices", {
    title: ids?.length ? "Invoices — selection" : "Invoices",
    subtitle: `${invoices?.length ?? 0} invoices`,
    columns,
    freezeColumns: 1,
  });

  const totals = { subtotal: 0, vat: 0, discount: 0, total: 0, paid: 0 };
  (invoices ?? []).forEach((inv, i) => {
    const subtotal = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    const vat = subtotal * (Number(inv.vat_rate ?? 5) / 100);
    const total = subtotal + vat - Number(inv.discount);
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    totals.subtotal += subtotal;
    totals.vat += vat;
    totals.discount += Number(inv.discount);
    totals.total += total;
    totals.paid += paid;

    const row = sheet.addRow({
      number: formatInvoiceNumber(inv.invoice_number, inv.created_at) ?? "",
      date: new Date(inv.created_at),
      customer: inv.customers?.name ?? "",
      phone: inv.customers?.phone ?? "",
      vehicle: inv.job_cards?.vehicles?.plate_number ?? "",
      job: inv.job_cards?.description ?? "Counter sale",
      subtotal,
      vat,
      discount: Number(inv.discount),
      total,
      paid,
      balance: Math.max(total - paid, 0),
      status: STATUS[inv.status]?.label ?? inv.status,
    });
    applyBodyRow(row, i, columns);
    statusCell(row.getCell("status"), STATUS[inv.status]?.tone ?? "warning");
  });

  const totalRow = sheet.addRow({
    number: "Total",
    customer: `${invoices?.length ?? 0} invoices`,
    subtotal: totals.subtotal,
    vat: totals.vat,
    discount: totals.discount,
    total: totals.total,
    paid: totals.paid,
    balance: Math.max(totals.total - totals.paid, 0),
  });
  applyTotalRow(totalRow, columns);

  return workbook;
}
