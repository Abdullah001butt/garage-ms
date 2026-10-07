import { createClient } from "@/lib/supabase/server";
import type { Part } from "@/lib/types";
import { createCounterSale } from "@/app/counter-sale/actions";
import { PageHeader } from "@/components/ui";
import { CounterSaleForm } from "@/components/CounterSaleForm";

export default async function CounterSalePage() {
  const supabase = await createClient();
  const [{ data: parts }, { data: settings }] = await Promise.all([
    supabase
      .from("parts")
      .select("id, name, sku, stock_qty, unit_price")
      .order("name")
      .returns<Pick<Part, "id" | "name" | "sku" | "stock_qty" | "unit_price">[]>(),
    supabase.from("shop_settings").select("vat_rate").limit(1).maybeSingle(),
  ]);

  return (
    <div className="page">
      <PageHeader
        title="Counter sale"
        description="Sell parts over the counter in seconds — no job card needed. Stock and cash update automatically."
      />
      <CounterSaleForm parts={parts ?? []} vatRate={Number(settings?.vat_rate ?? 5)} action={createCounterSale} />
    </div>
  );
}
