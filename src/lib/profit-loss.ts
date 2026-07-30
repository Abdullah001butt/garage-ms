import { createClient } from "@/lib/supabase/server";

type InvoiceRow = {
  discount: number;
  invoice_items: {
    quantity: number;
    unit_price: number;
    item_type: "part" | "labor" | "service";
    part_id: string | null;
  }[];
};

type PartRow = {
  id: string;
  unit_cost: number | null;
};

type ExpenseRow = {
  category: string;
  amount: number;
};

type SubletRow = {
  cost: number;
};

export type ProfitLossResult = {
  laborIncome: number;
  serviceIncome: number;
  partsRevenue: number;
  partsCost: number;
  partsMargin: number;
  totalDiscount: number;
  netRevenue: number;
  grossProfit: number;
  grossMarginPct: number;
  expensesByCategory: { category: string; amount: number }[];
  totalExpenses: number;
  subletCosts: number;
  netProfit: number;
  netMarginPct: number;
  invoiceCount: number;
  unlinkedPartsRevenue: number;
};

export async function computeProfitLoss(month: string): Promise<ProfitLossResult> {
  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, "0")}`;

  const supabase = await createClient();

  const [{ data: invoices }, { data: parts }, { data: expenses }, { data: sublets }] = await Promise.all([
    supabase
      .from("invoices")
      .select("discount, invoice_items(quantity, unit_price, item_type, part_id)")
      .eq("document_type", "invoice")
      .gte("created_at", monthStart)
      .lte("created_at", `${monthEnd}T23:59:59`)
      .returns<InvoiceRow[]>(),
    supabase.from("parts").select("id, unit_cost").returns<PartRow[]>(),
    supabase
      .from("expenses")
      .select("category, amount")
      .gte("expense_date", monthStart)
      .lte("expense_date", monthEnd)
      .returns<ExpenseRow[]>(),
    supabase
      .from("job_sublets")
      .select("cost")
      .gte("created_at", monthStart)
      .lte("created_at", `${monthEnd}T23:59:59`)
      .returns<SubletRow[]>(),
  ]);

  const costByPartId = new Map((parts ?? []).map((p) => [p.id, p.unit_cost ?? 0]));

  let laborIncome = 0;
  let serviceIncome = 0;
  let partsRevenue = 0;
  let partsCost = 0;
  let unlinkedPartsRevenue = 0;
  let totalDiscount = 0;

  for (const inv of invoices ?? []) {
    totalDiscount += Number(inv.discount);
    for (const item of inv.invoice_items) {
      const lineTotal = item.quantity * item.unit_price;
      if (item.item_type === "labor") {
        laborIncome += lineTotal;
      } else if (item.item_type === "service") {
        serviceIncome += lineTotal;
      } else {
        partsRevenue += lineTotal;
        if (item.part_id && costByPartId.has(item.part_id)) {
          partsCost += item.quantity * (costByPartId.get(item.part_id) ?? 0);
        } else {
          unlinkedPartsRevenue += lineTotal;
        }
      }
    }
  }

  const subletCosts = (sublets ?? []).reduce((s, sub) => s + Number(sub.cost), 0);
  const partsMargin = partsRevenue - partsCost;
  const netRevenue = laborIncome + serviceIncome + partsRevenue - totalDiscount;
  const grossProfit = laborIncome + serviceIncome + partsMargin - totalDiscount - subletCosts;

  const categoryMap = new Map<string, number>();
  for (const e of expenses ?? []) {
    categoryMap.set(e.category, (categoryMap.get(e.category) ?? 0) + Number(e.amount));
  }
  const expensesByCategory = [...categoryMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  const totalExpenses = expensesByCategory.reduce((s, e) => s + e.amount, 0);

  const netProfit = grossProfit - totalExpenses;

  return {
    laborIncome,
    serviceIncome,
    partsRevenue,
    partsCost,
    partsMargin,
    totalDiscount,
    netRevenue,
    grossProfit,
    grossMarginPct: netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0,
    expensesByCategory,
    totalExpenses,
    subletCosts,
    netProfit,
    netMarginPct: netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0,
    invoiceCount: invoices?.length ?? 0,
    unlinkedPartsRevenue,
  };
}
