"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function parseDollars(value: FormDataEntryValue | null): number | null {
  const input = String(value ?? "").trim();
  if (!input) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(input)) throw new Error("Allocation must be a non-negative dollar amount with no more than two decimals.");
  const [whole, fraction = ""] = input.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("Allocation is too large.");
  return cents;
}

export async function saveBudget(formData: FormData) {
  const client = await createSupabaseServerClient();
  if (!client) redirect("/settings/budgets?error=Supabase%20is%20not%20configured");
  const { data: membership } = await client.from("household_members").select("household_id,role").limit(1).maybeSingle();
  if (!membership?.household_id || membership.role !== "OWNER") redirect("/settings/budgets?error=Owner%20access%20required");
  const name = String(formData.get("name") ?? "").trim(); const cadence = String(formData.get("cadence") ?? "MONTHLY");
  const budgetId = String(formData.get("budgetId") ?? "").trim() || null;
  try {
    const { error } = await client.rpc("save_budget_definition", { p_household_id: membership.household_id, p_budget_id: budgetId, p_name: name, p_cadence: cadence, p_allocation_amount_cents: parseDollars(formData.get("allocation")), p_active: formData.get("active") !== "false" });
    if (error) throw error;
  } catch (error) { redirect(`/settings/budgets?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to save budget")}`); }
  revalidatePath("/"); revalidatePath("/plan"); revalidatePath("/settings/budgets"); redirect("/settings/budgets?saved=1");
}
