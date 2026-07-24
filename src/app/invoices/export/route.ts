import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { applyHeaderRow, applyBodyRow, applyTotalRow, CURRENCY_FORMAT, xlsxResponse } from "@/lib/xlsx-style";

type InvoiceRow = {
  id: string;
  created_at: string;
  status: string;
  discount: number;
  customers: { name: string; phone: string } | null;
  job_cards: { description: string; vehicles: { plate_number: string } | null } | null;
  invoice_items: { quantity: number; unit_price: number }[];
  payments: { amount: number }[];
};

const STATUS_COLOR: Record<string, string> = {
  paid: "FF16A34A",
  partial: "FFD97706",
  unpaid: "FFDC2626",
};

export async function GET() {
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, created_at, status, discount, customers(name, phone), job_cards(description, vehicles(plate_number)), invoice_items(quantity, unit_price), payments(amount)"
    )
    .eq("document_type", "invoice")
    .order("created_at", { ascending: false })
    .returns<InvoiceRow[]>();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Al Bahir Garage";
  const sheet = workbook.addWorksheet("Invoices", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Customer", key: "customer", width: 22 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Vehicle", key: "vehicle", width: 14 },
    { header: "Job Description", key: "job", width: 30 },
    { header: "Subtotal", key: "subtotal", width: 14, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Discount", key: "discount", width: 14, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Total", key: "total", width: 14, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Paid", key: "paid", width: 14, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Balance", key: "balance", width: 14, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Status", key: "status", width: 12 },
  ];
  applyHeaderRow(sheet.getRow(1));

  let totalRevenue = 0;
  let totalPaidSum = 0;

  (invoices ?? []).forEach((inv, i) => {
    const subtotal = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    const total = subtotal - inv.discount;
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    const balance = Math.max(total - paid, 0);
    totalRevenue += total;
    totalPaidSum += paid;

    const row = sheet.addRow({
      date: new Date(inv.created_at),
      customer: inv.customers?.name ?? "",
      phone: inv.customers?.phone ?? "",
      vehicle: inv.job_cards?.vehicles?.plate_number ?? "",
      job: inv.job_cards?.description ?? "",
      subtotal,
      discount: inv.discount,
      total,
      paid,
      balance,
      status: inv.status.toUpperCase(),
    });
    row.getCell("date").numFmt = "dd/mm/yyyy";
    applyBodyRow(row, i);
    row.getCell("status").font = { bold: true, color: { argb: STATUS_COLOR[inv.status] ?? "FF000000" } };
  });

  const totalRow = sheet.addRow({
    date: "",
    customer: "TOTAL",
    phone: "",
    vehicle: "",
    job: "",
    subtotal: "",
    discount: "",
    total: totalRevenue,
    paid: totalPaidSum,
    balance: totalRevenue - totalPaidSum,
    status: "",
  });
  applyTotalRow(totalRow);

  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, "invoices.xlsx");
}
