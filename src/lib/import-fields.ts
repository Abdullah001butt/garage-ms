/** What the Excel import understands, how it recognises columns, and how it cleans values. Shared by the screen and the server. */
import { EMIRATES, isValidPlateNumber, normalizePlateNumber } from "@/lib/plate";

export type ImportKind = "customers" | "parts";

export type FieldDef = { key: string; label: string; required?: boolean; group?: string; hint?: string; synonyms: string[] };

export const FIELDS: Record<ImportKind, FieldDef[]> = {
  customers: [
    { key: "name", label: "Customer name", required: true, group: "Customer", synonyms: ["name", "customer", "customer name", "full name", "client", "client name", "company", "company name", "owner", "owner name"] },
    { key: "phone", label: "Mobile", required: true, group: "Customer", synonyms: ["phone", "mobile", "mobile no", "mobile number", "phone number", "phone no", "contact", "contact no", "contact number", "tel", "telephone", "whatsapp", "cell", "gsm"] },
    { key: "customer_type", label: "Type", group: "Customer", hint: "Individual or Company", synonyms: ["type", "customer type", "category", "kind"] },
    { key: "email", label: "Email", group: "Customer", synonyms: ["email", "e mail", "mail", "email address"] },
    { key: "city", label: "City", group: "Customer", synonyms: ["city", "location", "area", "town"] },
    { key: "address", label: "Address", group: "Customer", synonyms: ["address", "full address", "street"] },
    { key: "trn_number", label: "TRN", group: "Customer", synonyms: ["trn", "trn number", "trn no", "vat number", "vat no", "tax number", "tax registration number"] },
    { key: "notes", label: "Notes", group: "Customer", synonyms: ["notes", "note", "remarks", "remark", "comment", "comments"] },
    { key: "plate_number", label: "Plate number", group: "Vehicle", hint: "e.g. A 12345", synonyms: ["plate", "plate no", "plate number", "registration", "registration no", "reg no", "vehicle no", "vehicle number", "car no", "car number", "number plate"] },
    { key: "emirate", label: "Plate emirate", group: "Vehicle", hint: "Blank = Ajman", synonyms: ["emirate", "plate emirate", "plate source", "source", "state", "plate city"] },
    { key: "make", label: "Make", group: "Vehicle", synonyms: ["make", "brand", "manufacturer", "car make"] },
    { key: "model", label: "Model", group: "Vehicle", synonyms: ["model", "car model", "vehicle model", "vehicle"] },
    { key: "year", label: "Year", group: "Vehicle", synonyms: ["year", "model year", "manufacturing year", "yr"] },
    { key: "color", label: "Colour", group: "Vehicle", synonyms: ["color", "colour"] },
    { key: "vin", label: "VIN / chassis", group: "Vehicle", synonyms: ["vin", "chassis", "chassis no", "chassis number", "vin number"] },
  ],
  parts: [
    { key: "name", label: "Part name", required: true, synonyms: ["name", "part", "part name", "item", "item name", "description", "product", "product name"] },
    { key: "sku", label: "SKU / part number", synonyms: ["sku", "code", "part no", "part number", "item code", "barcode", "ref", "reference"] },
    { key: "stock_qty", label: "Stock on hand", hint: "Blank = 0", synonyms: ["stock", "qty", "quantity", "stock qty", "on hand", "in stock", "balance", "available"] },
    { key: "unit_cost", label: "Cost (AED)", synonyms: ["cost", "unit cost", "purchase price", "buy price", "cost price", "buying price"] },
    { key: "unit_price", label: "Selling price (AED)", synonyms: ["price", "unit price", "selling price", "sale price", "sell price", "rate", "retail price"] },
    { key: "reorder_threshold", label: "Reorder level", hint: "Blank = 5", synonyms: ["reorder", "reorder level", "reorder point", "min", "minimum", "min stock", "min qty"] },
    { key: "supplier_name", label: "Supplier", synonyms: ["supplier", "vendor", "supplier name", "vendor name"] },
    { key: "supplier_phone", label: "Supplier phone", synonyms: ["supplier phone", "vendor phone", "supplier mobile", "supplier contact"] },
  ],
};

const clean = (h: string) =>
  h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Guesses which spreadsheet column feeds each field. Exact names win over partial matches; a column is used once. */
export function autoMap(kind: ImportKind, headers: string[]): Record<string, number | null> {
  const map: Record<string, number | null> = {};
  const used = new Set<number>();
  const cleaned = headers.map(clean);
  for (const pass of ["exact", "contains"] as const) {
    for (const f of FIELDS[kind]) {
      if (map[f.key] !== undefined && map[f.key] !== null) continue;
      const i = cleaned.findIndex(
        (h, idx) => !used.has(idx) && h && f.synonyms.some((s) => (pass === "exact" ? h === s : h.includes(s) && s.length >= 3))
      );
      if (i >= 0) {
        map[f.key] = i;
        used.add(i);
      } else map[f.key] = null;
    }
  }
  return map;
}

/* ───────── value cleaning ───────── */
export function cleanPhone(raw: string) {
  let v = raw.trim();
  if (!v) return "";
  const digits = v.replace(/\D/g, "");
  // Excel drops the leading 0 of UAE mobiles stored as numbers (501234567 → 0501234567).
  if (/^\d+$/.test(v) && digits.length === 9 && digits.startsWith("5")) v = `0${digits}`;
  return v;
}
/** Same customer whatever the spacing or +971: compare the last 9 digits. */
export const phoneKey = (raw: string) => raw.replace(/\D/g, "").slice(-9);

const EMIRATE_ALIASES: Record<string, (typeof EMIRATES)[number]> = {
  dxb: "Dubai", dubai: "Dubai", auh: "Abu Dhabi", ad: "Abu Dhabi", "abu dhabi": "Abu Dhabi", abudhabi: "Abu Dhabi",
  shj: "Sharjah", sharjah: "Sharjah", ajm: "Ajman", ajman: "Ajman", uaq: "Umm Al Quwain", "umm al quwain": "Umm Al Quwain",
  rak: "Ras Al Khaimah", "ras al khaimah": "Ras Al Khaimah", fuj: "Fujairah", fujairah: "Fujairah",
};
export function cleanEmirate(raw: string) {
  const k = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return k ? (EMIRATE_ALIASES[k] ?? EMIRATE_ALIASES[k.replace(/\s/g, "")] ?? null) : "Ajman";
}

export function cleanPlate(raw: string) {
  const v = normalizePlateNumber(raw);
  return v && isValidPlateNumber(v) ? v : null;
}
export const plateKey = (plate: string, emirate: string) => `${plate.toUpperCase().replace(/\s+/g, "")}|${emirate}`;

const COMPANY_NAME = /\b(llc|l\.l\.c|est|establishment|trading|transport|company|co|fzc|fze|fzco|group|services|contracting|logistics|motors|rent a car|ltd)\b/i;
export function cleanType(raw: string, name: string): "individual" | "company" {
  const v = raw.trim().toLowerCase();
  if (v) return /comp|corp|business|firm|llc|fleet|org/.test(v) ? "company" : "individual";
  return COMPANY_NAME.test(name) ? "company" : "individual";
}

export function cleanNumber(raw: string) {
  const v = raw.replace(/aed|dhs?|,/gi, "").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function cleanYear(raw: string) {
  const n = cleanNumber(raw);
  if (n === null) return null;
  return Number.isInteger(n) && n >= 1950 && n <= new Date().getFullYear() + 1 ? n : NaN;
}

export const nameKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
