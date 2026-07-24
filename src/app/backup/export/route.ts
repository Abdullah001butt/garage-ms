import JSZip from "jszip";
import { buildCustomersWorkbook } from "@/lib/exports/customers";
import { buildInvoicesWorkbook } from "@/lib/exports/invoices";
import { buildExpensesWorkbook } from "@/lib/exports/expenses";
import { buildAttendanceWorkbook } from "@/lib/exports/attendance";
import { buildProfitLossWorkbook } from "@/lib/exports/profit-loss";

export async function GET() {
  const month = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);

  const [customers, invoices, expenses, attendance, profitLoss] = await Promise.all([
    buildCustomersWorkbook(),
    buildInvoicesWorkbook(),
    buildExpensesWorkbook(),
    buildAttendanceWorkbook(month),
    buildProfitLossWorkbook(month),
  ]);

  const zip = new JSZip();
  zip.file("customers.xlsx", await customers.xlsx.writeBuffer());
  zip.file("invoices.xlsx", await invoices.xlsx.writeBuffer());
  zip.file("expenses.xlsx", await expenses.xlsx.writeBuffer());
  zip.file(`attendance-${month}.xlsx`, await attendance.xlsx.writeBuffer());
  zip.file(`profit-loss-${month}.xlsx`, await profitLoss.xlsx.writeBuffer());

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  return new Response(zipBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="al-bahir-garage-backup-${today}.zip"`,
    },
  });
}
