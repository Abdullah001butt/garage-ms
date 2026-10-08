"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import {
  cleanEmirate,
  cleanNumber,
  cleanPhone,
  cleanPlate,
  cleanType,
  cleanYear,
  nameKey,
  phoneKey,
  plateKey,
} from "@/lib/import-fields";

export type ImportRow = { row: number; values: Record<string, string> };
export type ImportResult = {
  ok: boolean;
  error?: string;
  created: number;
  updated: number;
  skipped: number;
  vehicles: number;
  problems: { row: number; message: string }[];
};

const empty = (): ImportResult => ({ ok: true, created: 0, updated: 0, skipped: 0, vehicles: 0, problems: [] });

async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in again.");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "owner") throw new Error("Only an owner can import data.");
  return supabase;
}

/** What's already in the system, so the preview can mark rows that will be skipped. */
export async function existingKeys(kind: "customers" | "parts") {
  const supabase = await requireOwner();
  if (kind === "customers") {
    const [{ data: c }, { data: v }] = await Promise.all([
      supabase.from("customers").select("phone"),
      supabase.from("vehicles").select("plate_number, emirate"),
    ]);
    return {
      phones: (c ?? []).map((x) => phoneKey(x.phone ?? "")).filter(Boolean),
      plates: (v ?? []).map((x) => plateKey(x.plate_number, x.emirate)),
    };
  }
  const { data: p } = await supabase.from("parts").select("name, sku");
  return { names: (p ?? []).map((x) => nameKey(x.name)), skus: (p ?? []).map((x) => (x.sku ? nameKey(x.sku) : "")).filter(Boolean) };
}

/** Customers (+ their cars) in one batch. One row can carry one car; rows sharing a mobile become one customer with several cars. */
export async function importCustomers(rows: ImportRow[]): Promise<ImportResult> {
  const res = empty();
  try {
    const supabase = await requireOwner();
    const [{ data: existingCustomers }, { data: existingVehicles }] = await Promise.all([
      supabase.from("customers").select("id, phone"),
      supabase.from("vehicles").select("plate_number, emirate"),
    ]);
    const byPhone = new Map<string, string>();
    for (const c of existingCustomers ?? []) if (c.phone) byPhone.set(phoneKey(c.phone), c.id);
    const plates = new Set((existingVehicles ?? []).map((v) => plateKey(v.plate_number, v.emirate)));

    // 1) New customers (first row per mobile wins).
    const fresh = new Map<string, { row: number; data: Record<string, unknown> }>();
    const valid: (ImportRow & { key: string })[] = [];
    for (const r of rows) {
      const v = r.values;
      const name = (v.name ?? "").trim();
      const phone = cleanPhone(v.phone ?? "");
      const key = phoneKey(phone);
      if (!name) {
        res.problems.push({ row: r.row, message: "Missing customer name" });
        continue;
      }
      if (key.length < 7) {
        res.problems.push({ row: r.row, message: "Missing or invalid mobile number" });
        continue;
      }
      valid.push({ ...r, key });
      if (byPhone.has(key) || fresh.has(key)) continue;
      fresh.set(key, {
        row: r.row,
        data: {
          name,
          phone,
          customer_type: cleanType(v.customer_type ?? "", name),
          email: v.email?.trim() || null,
          city: v.city?.trim() || null,
          address: v.address?.trim() || null,
          trn_number: v.trn_number?.trim() || null,
          notes: v.notes?.trim() || null,
        },
      });
    }
    const skippedCustomers = new Set(valid.filter((r) => byPhone.has(r.key)).map((r) => r.key));
    res.skipped += skippedCustomers.size;

    if (fresh.size) {
      const list = [...fresh.entries()];
      const { data: inserted, error } = await supabase
        .from("customers")
        .insert(list.map(([, x]) => x.data))
        .select("id, phone");
      if (error) return { ...res, ok: false, error: error.message };
      for (const c of inserted ?? []) byPhone.set(phoneKey(c.phone), c.id);
      res.created += inserted?.length ?? 0;
    }

    // 2) Their cars.
    const cars: Record<string, unknown>[] = [];
    for (const r of valid) {
      const v = r.values;
      if (!(v.plate_number ?? "").trim()) continue;
      const plate = cleanPlate(v.plate_number);
      const emirate = cleanEmirate(v.emirate ?? "");
      if (!plate) {
        res.problems.push({ row: r.row, message: `Plate “${v.plate_number}” isn’t a UAE plate (e.g. A 12345) — customer added, car skipped` });
        continue;
      }
      if (!emirate) {
        res.problems.push({ row: r.row, message: `Unknown emirate “${v.emirate}” — car skipped` });
        continue;
      }
      const pk = plateKey(plate, emirate);
      if (plates.has(pk)) continue;
      const year = cleanYear(v.year ?? "");
      plates.add(pk);
      cars.push({
        customer_id: byPhone.get(r.key),
        plate_number: plate,
        emirate,
        make: v.make?.trim() || null,
        model: v.model?.trim() || null,
        year: Number.isNaN(year) ? null : year,
        color: v.color?.trim() || null,
        vin: v.vin?.trim() || null,
      });
    }
    if (cars.length) {
      const { error } = await supabase.from("vehicles").insert(cars);
      if (error) return { ...res, ok: false, error: error.message };
      res.vehicles = cars.length;
    }
    await logAudit("import.customers", "customer", null, { created: res.created, vehicles: res.vehicles, skipped: res.skipped });
    revalidatePath("/customers");
    return res;
  } catch (e) {
    return { ...res, ok: false, error: e instanceof Error ? e.message : "Import failed" };
  }
}

/** Parts in one batch. Existing parts (same SKU, or same name) are skipped — or updated when asked. */
export async function importParts(rows: ImportRow[], updateExisting: boolean): Promise<ImportResult> {
  const res = empty();
  try {
    const supabase = await requireOwner();
    const { data: existing } = await supabase.from("parts").select("id, name, sku, stock_qty");
    const bySku = new Map<string, { id: string; stock_qty: number }>();
    const byName = new Map<string, { id: string; stock_qty: number }>();
    for (const p of existing ?? []) {
      if (p.sku) bySku.set(nameKey(p.sku), p);
      byName.set(nameKey(p.name), p);
    }
    const fresh: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const v = r.values;
      const name = (v.name ?? "").trim();
      if (!name) {
        res.problems.push({ row: r.row, message: "Missing part name" });
        continue;
      }
      const sku = (v.sku ?? "").trim() || null;
      const nums = {
        stock_qty: cleanNumber(v.stock_qty ?? ""),
        unit_cost: cleanNumber(v.unit_cost ?? ""),
        unit_price: cleanNumber(v.unit_price ?? ""),
        reorder_threshold: cleanNumber(v.reorder_threshold ?? ""),
      };
      const bad = Object.entries(nums).find(([, n]) => Number.isNaN(n) || (n !== null && n < 0));
      if (bad) {
        res.problems.push({ row: r.row, message: `“${v[bad[0]]}” isn’t a valid number` });
        continue;
      }
      const key = sku ? `sku:${nameKey(sku)}` : `name:${nameKey(name)}`;
      if (seen.has(key)) {
        res.problems.push({ row: r.row, message: "Same part appears twice in the file — kept the first" });
        continue;
      }
      seen.add(key);
      const match = (sku && bySku.get(nameKey(sku))) || byName.get(nameKey(name));
      const fields: Record<string, unknown> = {};
      if (nums.unit_cost !== null) fields.unit_cost = nums.unit_cost;
      if (nums.unit_price !== null) fields.unit_price = nums.unit_price;
      if (nums.reorder_threshold !== null) fields.reorder_threshold = Math.round(nums.reorder_threshold);
      if (v.supplier_name?.trim()) fields.supplier_name = v.supplier_name.trim();
      if (v.supplier_phone?.trim()) fields.supplier_phone = v.supplier_phone.trim();

      if (match) {
        if (!updateExisting) {
          res.skipped++;
          continue;
        }
        if (Object.keys(fields).length) {
          const { error } = await supabase.from("parts").update(fields).eq("id", match.id);
          if (error) {
            res.problems.push({ row: r.row, message: error.message });
            continue;
          }
        }
        if (nums.stock_qty !== null && Math.round(nums.stock_qty) !== Number(match.stock_qty)) {
          const { error } = await supabase.rpc("adjust_part_stock", { p_part_id: match.id, p_new_qty: Math.round(nums.stock_qty), p_note: "Excel import" });
          if (error) res.problems.push({ row: r.row, message: error.message });
        }
        res.updated++;
        continue;
      }
      fresh.push({ name, sku, stock_qty: Math.round(nums.stock_qty ?? 0), reorder_threshold: 5, ...fields });
    }
    if (fresh.length) {
      const { error } = await supabase.from("parts").insert(fresh);
      if (error) return { ...res, ok: false, error: error.message };
      res.created += fresh.length;
    }
    await logAudit("import.parts", "part", null, { created: res.created, updated: res.updated, skipped: res.skipped });
    revalidatePath("/inventory");
    return res;
  } catch (e) {
    return { ...res, ok: false, error: e instanceof Error ? e.message : "Import failed" };
  }
}
