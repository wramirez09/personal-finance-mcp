import { z } from "zod";
import { getSupabase, type Transaction } from "../supabase";
import { ok, err } from "./result";

export const getTransactionsDescription =
  "Retrieve transactions from linked bank and credit card accounts. " +
  "Use this when the user asks about spending, charges, deposits, specific merchants, refunds, or any transaction-level question. " +
  "Filter by required date range and optional category, merchant (substring, case-insensitive), amount range, or account_id. " +
  "Returns up to 200 most recent matches sorted by date desc; sets truncated=true if more rows exist. " +
  "Amount convention: positive=outflow (money leaving), negative=inflow (money arriving), per Plaid.";

export const getTransactionsSchema = {
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  category: z.string().optional(),
  merchant: z.string().optional(),
  min_amount: z.number().optional(),
  max_amount: z.number().optional(),
  account_id: z.string().uuid().optional(),
};

const PAGE_LIMIT = 200;

type Args = {
  start_date: string;
  end_date: string;
  category?: string;
  merchant?: string;
  min_amount?: number;
  max_amount?: number;
  account_id?: string;
};

export async function getTransactions(args: Args) {
  const supa = getSupabase();
  let q = supa
    .from("transactions")
    .select(
      "id, account_id, external_id, amount, date, name, merchant_name, category, subcategory, pending, created_at",
      { count: "exact" },
    )
    .gte("date", args.start_date)
    .lte("date", args.end_date);

  if (args.category) q = q.eq("category", args.category);
  if (args.merchant) q = q.ilike("merchant_name", `%${args.merchant}%`);
  if (args.min_amount !== undefined) q = q.gte("amount", args.min_amount);
  if (args.max_amount !== undefined) q = q.lte("amount", args.max_amount);
  if (args.account_id) q = q.eq("account_id", args.account_id);

  q = q.order("date", { ascending: false }).limit(PAGE_LIMIT);

  const { data, error, count } = await q;
  if (error) return err(`Database error: ${error.message}`);

  const rows = (data ?? []) as Transaction[];
  return ok({
    transactions: rows,
    returned: rows.length,
    total_matching: count ?? null,
    truncated: count != null && count > rows.length,
  });
}
