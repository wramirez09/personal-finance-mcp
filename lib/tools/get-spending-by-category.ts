import { z } from "zod";
import { getSupabase } from "../supabase";
import { ok, err } from "./result";

export const getSpendingByCategoryDescription =
  "Summarize spending grouped by category over a date range. " +
  "Use when the user asks where their money went, top spending categories, or spending breakdowns. " +
  "Excludes inflows: only positive amounts are counted (Plaid convention: positive=outflow). " +
  "Returns categories sorted by total descending, plus a grand total and transaction count per category.";

export const getSpendingByCategorySchema = {
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  account_id: z.string().uuid().optional(),
};

type Args = { start_date: string; end_date: string; account_id?: string };

export async function getSpendingByCategory(args: Args) {
  const supa = getSupabase();
  // Plaid convention: positive amount = outflow. Filter > 0 to exclude refunds/inflows.
  let q = supa
    .from("transactions")
    .select("category, amount")
    .gte("date", args.start_date)
    .lte("date", args.end_date)
    .gt("amount", 0);
  if (args.account_id) q = q.eq("account_id", args.account_id);

  const { data, error } = await q;
  if (error) return err(`Database error: ${error.message}`);

  const buckets = new Map<string, { total: number; count: number }>();
  let grand = 0;
  for (const row of (data ?? []) as { category: string | null; amount: number }[]) {
    const key = row.category ?? "Uncategorized";
    const b = buckets.get(key) ?? { total: 0, count: 0 };
    b.total += Number(row.amount);
    b.count += 1;
    buckets.set(key, b);
    grand += Number(row.amount);
  }

  const categories = Array.from(buckets.entries())
    .map(([category, { total, count }]) => ({
      category,
      total: Number(total.toFixed(2)),
      transaction_count: count,
    }))
    .sort((a, b) => b.total - a.total);

  return ok({
    start_date: args.start_date,
    end_date: args.end_date,
    grand_total: Number(grand.toFixed(2)),
    categories,
  });
}
