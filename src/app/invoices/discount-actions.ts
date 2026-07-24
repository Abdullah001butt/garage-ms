"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateDiscount(invoiceId: string, formData: FormData) {
  const supabase = await createClient();
  const discount = Number(formData.get("discount") ?? 0);

  const { error } = await supabase
    .from("invoices")
    .update({ discount: discount || 0 })
    .eq("id", invoiceId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/estimates/${invoiceId}`);
}
