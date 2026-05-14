import { z } from "zod";
import { getSupabase, type Holding } from "../supabase";
import { ok, err } from "./result";

export const getHoldingsDescription =
  "Return current investment holdings (positions) from brokerage and 401k accounts. " +
  "Use when the user asks about their portfolio, stock/ETF positions, asset values, or cost basis. " +
  "Optionally filter by account_id. Each holding includes symbol, description, quantity, price, market_value, " +
  "cost_basis, and unrealized_gain_loss (market_value - cost_basis). " +
  "Also returns total_market_value summed across the returned holdings.";

export const getHoldingsSchema = {
  account_id: z.string().uuid().optional(),
};

export async function getHoldings(args: { account_id?: string }) {
  const supa = getSupabase();
  let q = supa
    .from("holdings")
    .select("id, account_id, symbol, description, quantity, price, market_value, cost_basis, currency, updated_at");
  if (args.account_id) q = q.eq("account_id", args.account_id);

  const { data, error } = await q;
  if (error) return err(`Database error: ${error.message}`);

  const rows = (data ?? []) as Holding[];
  const holdings = rows.map((h) => ({
    ...h,
    unrealized_gain_loss:
      h.market_value != null && h.cost_basis != null
        ? Number((Number(h.market_value) - Number(h.cost_basis)).toFixed(2))
        : null,
  }));
  const total_market_value = Number(
    holdings.reduce((s, h) => s + (h.market_value ? Number(h.market_value) : 0), 0).toFixed(2),
  );

  return ok({ holdings, count: holdings.length, total_market_value });
}
