import { getSupabase, type Account } from "../supabase";
import { ok, err } from "./result";

export const listAccountsDescription =
  "List every linked financial account (banks, credit cards, brokerages, loans) with current balances. " +
  "Call this when the user asks what accounts they have, account balances, total cash, or which institutions are connected. " +
  "Returns an array of accounts with id, name, institution, type, subtype, mask, current_balance, available_balance, " +
  "credit_limit, currency, and (for credit accounts) computed utilization_pct.";

export async function listAccounts() {
  const supa = getSupabase();
  const { data, error } = await supa
    .from("accounts")
    .select(
      "id, external_id, source, name, institution, type, subtype, mask, current_balance, available_balance, credit_limit, currency, updated_at",
    )
    .order("type", { ascending: true })
    .order("name", { ascending: true });
  if (error) return err(`Database error: ${error.message}`);

  const accounts = (data as Account[]).map((a) => ({
    ...a,
    utilization_pct:
      a.type === "credit" && a.credit_limit && a.credit_limit > 0 && a.current_balance != null
        ? Number(((a.current_balance / a.credit_limit) * 100).toFixed(2))
        : null,
  }));
  return ok({ accounts, count: accounts.length });
}
