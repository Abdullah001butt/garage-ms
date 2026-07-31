import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { applyHeaderRow, applyBodyRow } from "@/lib/xlsx-style";

type CustomerRow = {
  name: string;
  customer_type: string;
  phone: string;
  landline: string | null;
  email: string | null;
  trn_number: string | null;
  representative: string | null;
  reference_name: string | null;
  address: string | null;
  city: string | null;
  created_at: string;
  vehicles: {
    plate_number: string;
    emirate: string;
    registration_expiry_date: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    origin_trim: string | null;
    vin: string | null;
    body_type: string | null;
    color: string | null;
    cylinders: number | null;
    current_mileage: number | null;
    odometer_reading: number | null;
  }[];
};

export async function buildCustomersWorkbook() {
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select(
      "name, customer_type, phone, landline, email, trn_number, representative, reference_name, address, city, created_at, vehicles(plate_number, emirate, registration_expiry_date, make, model, year, origin_trim, vin, body_type, color, cylinders, current_mileage, odometer_reading)"
    )
    .order("name")
    .returns<CustomerRow[]>();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Al Bahir Garage";
  const sheet = workbook.addWorksheet("Customers", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Type", key: "customer_type", width: 12 },
    { header: "Customer / Company Name", key: "name", width: 26 },
    { header: "TRN/VAT Number", key: "trn_number", width: 18 },
    { header: "Mobile No", key: "phone", width: 16 },
    { header: "Landline", key: "landline", width: 16 },
    { header: "Email", key: "email", width: 24 },
    { header: "Representative", key: "representative", width: 20 },
    { header: "Reference Name", key: "reference_name", width: 20 },
    { header: "Address", key: "address", width: 26 },
    { header: "City", key: "city", width: 16 },
    { header: "Plate Number", key: "plate", width: 14 },
    { header: "Emirate", key: "emirate", width: 14 },
    { header: "Registration Expiry", key: "reg_expiry", width: 16 },
    { header: "Make", key: "make", width: 14 },
    { header: "Model", key: "model", width: 14 },
    { header: "Year", key: "year", width: 10 },
    { header: "Origin/Trim", key: "origin_trim", width: 14 },
    { header: "VIN", key: "vin", width: 20 },
    { header: "Body Type", key: "body_type", width: 12 },
    { header: "Color", key: "color", width: 12 },
    { header: "Cylinders", key: "cylinders", width: 10 },
    { header: "Current Mileage (KM)", key: "current_mileage", width: 16 },
    { header: "Odometer Reading", key: "odometer_reading", width: 16 },
    { header: "Customer Since", key: "since", width: 16 },
  ];
  applyHeaderRow(sheet.getRow(1));

  let rowIndex = 0;
  for (const c of customers ?? []) {
    const vehicles = c.vehicles.length > 0 ? c.vehicles : [null];
    for (const v of vehicles) {
      const row = sheet.addRow({
        customer_type: c.customer_type === "company" ? "Company" : "Individual",
        name: c.name,
        trn_number: c.trn_number ?? "",
        phone: c.phone,
        landline: c.landline ?? "",
        email: c.email ?? "",
        representative: c.representative ?? "",
        reference_name: c.reference_name ?? "",
        address: c.address ?? "",
        city: c.city ?? "",
        plate: v?.plate_number ?? "",
        emirate: v?.emirate ?? "",
        reg_expiry: v?.registration_expiry_date ? new Date(v.registration_expiry_date) : "",
        make: v?.make ?? "",
        model: v?.model ?? "",
        year: v?.year ?? "",
        origin_trim: v?.origin_trim ?? "",
        vin: v?.vin ?? "",
        body_type: v?.body_type ?? "",
        color: v?.color ?? "",
        cylinders: v?.cylinders ?? "",
        current_mileage: v?.current_mileage ?? "",
        odometer_reading: v?.odometer_reading ?? "",
        since: new Date(c.created_at),
      });
      if (v?.registration_expiry_date) row.getCell("reg_expiry").numFmt = "dd/mm/yyyy";
      row.getCell("since").numFmt = "dd/mm/yyyy";
      applyBodyRow(row, rowIndex);
      rowIndex++;
    }
  }

  return workbook;
}
