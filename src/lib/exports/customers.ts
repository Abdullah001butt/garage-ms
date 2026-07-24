import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { applyHeaderRow, applyBodyRow } from "@/lib/xlsx-style";

type CustomerRow = {
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  created_at: string;
  vehicles: {
    plate_number: string;
    make: string | null;
    model: string | null;
    year: number | null;
    color: string | null;
  }[];
};

export async function buildCustomersWorkbook() {
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("name, phone, email, address, created_at, vehicles(plate_number, make, model, year, color)")
    .order("name")
    .returns<CustomerRow[]>();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Al Bahir Garage";
  const sheet = workbook.addWorksheet("Customers", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Customer Name", key: "name", width: 24 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Email", key: "email", width: 24 },
    { header: "Address", key: "address", width: 28 },
    { header: "Plate Number", key: "plate", width: 16 },
    { header: "Make", key: "make", width: 14 },
    { header: "Model", key: "model", width: 14 },
    { header: "Year", key: "year", width: 10 },
    { header: "Color", key: "color", width: 12 },
    { header: "Customer Since", key: "since", width: 16 },
  ];
  applyHeaderRow(sheet.getRow(1));

  let rowIndex = 0;
  for (const c of customers ?? []) {
    const vehicles = c.vehicles.length > 0 ? c.vehicles : [null];
    for (const v of vehicles) {
      const row = sheet.addRow({
        name: c.name,
        phone: c.phone,
        email: c.email ?? "",
        address: c.address ?? "",
        plate: v?.plate_number ?? "",
        make: v?.make ?? "",
        model: v?.model ?? "",
        year: v?.year ?? "",
        color: v?.color ?? "",
        since: new Date(c.created_at),
      });
      row.getCell("since").numFmt = "dd/mm/yyyy";
      applyBodyRow(row, rowIndex);
      rowIndex++;
    }
  }

  return workbook;
}
