import { getSupabase, type Account } from "../supabase";
import { ok, err } from "./result";

export const getCreditUtilizationDescription =
  "Return credit card utilization metrics: per-card utilization percentage, total balance owed, " +
  "total available credit, and overall utilization across all credit cards. " +
  "Use when the user asks about credit utilization, credit health, available credit, or how their cards are doing.";

export async function getCreditUtilization() {
  const supa = getSupabase();
  const { data, error } = await supa
    .from("accounts")
    .select("id, name, institution, mask, current_balance, credit_limit, type")
    .eq("type", "credit");
  if (error) return err(`Database error: ${error.message}`);

  let total_owed = 0;
  let total_limit = 0;
  const cards = ((data ?? []) as Account[]).map((c) => {
    const balance = c.current_balance != null ? Number(c.current_balance) : 0;
    const limit = c.credit_limit != null ? Number(c.credit_limit) : 0;
    total_owed += balance;
    total_limit += limit;
    return {
      id: c.id,
      name: c.name,
      institution: c.institution,
      mask: c.mask,
      current_balance: balance,
      credit_limit: c.credit_limit,
      utilization_pct: limit > 0 ? Number(((balance / limit) * 100).toFixed(2)) : null,
    };
  });

  return ok({
    cards,
    total_balance_owed: Number(total_owed.toFixed(2)),
    total_credit_limit: Number(total_limit.toFixed(2)),
    total_available_credit: Number((total_limit - total_owed).toFixed(2)),
    overall_utilization_pct:
      total_limit > 0 ? Number(((total_owed / total_limit) * 100).toFixed(2)) : null,
  });
}
