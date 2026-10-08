import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { applyBodyRow, startSheet, DATE_FORMAT, NUMBER_FORMAT, type SheetColumn } from "@/lib/xlsx-style";
import { buildDashboard, share, INT, PCT } from "@/lib/xlsx-dashboard";
import { dayKey } from "@/lib/format";
import { shiftMonth } from "@/lib/salary";

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

export async function buildCustomersWorkbook(ids?: string[]) {
  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select(
      "name, customer_type, phone, landline, email, trn_number, representative, reference_name, address, city, created_at, is_walk_in, vehicles(plate_number, emirate, registration_expiry_date, make, model, year, origin_trim, vin, body_type, color, cylinders, current_mileage, odometer_reading)"
    )
    .order("name");
  if (ids?.length) query = query.in("id", ids);
  const { data: rawCustomers } = await query.returns<(CustomerRow & { is_walk_in?: boolean })[]>();
  // The shared walk-in customer (counter sales) is bookkeeping, not a real customer.
  const customers = (rawCustomers ?? []).filter((c) => !c.is_walk_in);

  const vehicles = customers.flatMap((c) => c.vehicles);
  const companies = customers.filter((c) => c.customer_type === "company").length;
  const count = <T,>(rows: T[], key: (r: T) => string) => [...rows.reduce((m, r) => m.set(key(r), (m.get(key(r)) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const makes = count(vehicles, (v) => (v.make ?? "").trim() || "Unknown");
  const emirates = count(vehicles, (v) => v.emirate || "Unknown");
  const cities = count(customers, (c) => (c.city ?? "").trim() || "Not set");
  const thisMonth = dayKey(new Date()).slice(0, 7);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(thisMonth, i - 5));
  const joined = months.map((m) => customers.filter((c) => dayKey(c.created_at).slice(0, 7) === m).length);
  const shortMonth = (m: string) => new Date(`${m}-15T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });

  const workbook = new ExcelJS.Workbook();
  buildDashboard(workbook, {
    kicker: ids?.length ? "Customers · selection" : "Customers & vehicles",
    title: ids?.length ? `${customers.length} selected customers` : "Customer book",
    subtitle: `${customers.length} customers  ·  ${vehicles.length} vehicles on file`,
    kpis: [
      { label: "Customers", value: customers.length, numFmt: INT, note: `${joined[5]} new this month` },
      { label: "Companies", value: companies, numFmt: INT, note: `${Math.round(share(companies, customers.length) * 100)}% of customers` },
      { label: "Individuals", value: customers.length - companies, numFmt: INT },
      { label: "Vehicles", value: vehicles.length, numFmt: INT, note: customers.length ? `${(vehicles.length / customers.length).toFixed(1)} per customer` : "" },
    ],
    groups: [
      {
        widths: [18, 12, 10],
        top: {
          kind: "info",
          title: "Report details",
          rows: [
            ["Exported", new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" })],
            ["Customers", customers.length, INT],
            ["Vehicles", vehicles.length, INT],
            ["Makes", makes.length, INT],
            ["Cities", cities.length, INT],
          ],
        },
        tables: [
          {
            title: "Customers by city",
            columns: [{ header: "City" }, { header: "Customers", numFmt: INT, align: "center" }, { header: "Share", numFmt: PCT, bar: true }],
            rows: cities.slice(0, 10).map(([c, n]) => [c, n, share(n, customers.length)]),
            empty: "No customers yet",
          },
        ],
      },
      {
        widths: [16, 12, 12],
        top: { kind: "chart", chart: { title: "New customers · 6 months", type: "column", categories: months.map(shortMonth), series: [{ name: "New customers", values: joined }] } },
        tables: [
          {
            title: "Customer type",
            columns: [{ header: "Type" }, { header: "Customers", numFmt: INT, align: "center" }, { header: "Share", numFmt: PCT, bar: true }],
            rows: [
              ["Companies", companies, share(companies, customers.length)],
              ["Individuals", customers.length - companies, share(customers.length - companies, customers.length)],
            ],
            total: ["Total", customers.length, customers.length ? 1 : 0],
          },
        ],
      },
      {
        widths: [18, 12, 10],
        top: { kind: "chart", chart: { title: "Top car makes", type: "bar", labels: "value", categories: makes.slice(0, 7).map(([m]) => m), series: [{ name: "Vehicles", values: makes.slice(0, 7).map(([, n]) => n) }] } },
        tables: [
          {
            title: "Vehicles by make",
            columns: [{ header: "Make" }, { header: "Vehicles", numFmt: INT, align: "center" }, { header: "Share", numFmt: PCT, bar: true }],
            rows: makes.slice(0, 12).map(([m, n]) => [m, n, share(n, vehicles.length)]),
            empty: "No vehicles yet",
          },
        ],
      },
      {
        widths: [18, 12, 10],
        top: { kind: "chart", chart: { title: "Plates by emirate", type: "doughnut", categories: emirates.map(([e]) => e), series: [{ name: "Vehicles", values: emirates.map(([, n]) => n) }] } },
        tables: [
          {
            title: "Plates by emirate",
            columns: [{ header: "Emirate" }, { header: "Vehicles", numFmt: INT, align: "center" }, { header: "Share", numFmt: PCT, bar: true }],
            rows: emirates.map(([e, n]) => [e, n, share(n, vehicles.length)]),
            empty: "No vehicles yet",
          },
        ],
      },
    ],
  });

  const columns: SheetColumn[] = [
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
    { header: "Registration Expiry", key: "reg_expiry", width: 16, numFmt: DATE_FORMAT },
    { header: "Make", key: "make", width: 14 },
    { header: "Model", key: "model", width: 14 },
    { header: "Year", key: "year", width: 10, align: "center" },
    { header: "Origin/Trim", key: "origin_trim", width: 14 },
    { header: "VIN", key: "vin", width: 20 },
    { header: "Body Type", key: "body_type", width: 12 },
    { header: "Color", key: "color", width: 12 },
    { header: "Cylinders", key: "cylinders", width: 10, align: "center" },
    { header: "Current Mileage (KM)", key: "current_mileage", width: 16, numFmt: NUMBER_FORMAT },
    { header: "Odometer Reading", key: "odometer_reading", width: 16, numFmt: NUMBER_FORMAT },
    { header: "Customer Since", key: "since", width: 16, numFmt: DATE_FORMAT },
  ];
  const { sheet } = startSheet(workbook, "All customers", {
    band: "Customers and their vehicles",
    title: "Customers & Vehicles",
    subtitle: `${customers?.length ?? 0} customers`,
    columns,
    freezeColumns: 2,
    landscape: true,
  });

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
      applyBodyRow(row, rowIndex, columns);
      rowIndex++;
    }
  }

  return workbook;
}
