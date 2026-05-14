import { z } from "zod";
import { getSupabase } from "../supabase";
import { ok, err } from "./result";

export const getNetWorthHistoryDescription =
  "Return net worth over time from daily balance snapshots, summed across all accounts. " +
  "Use when the user asks about net worth trend, wealth over time, or how their finances have changed. " +
  "Credit and loan account balances are treated as negative (debt) in the net worth calculation. " +
  "Granularity: 'daily' returns one point per day; 'weekly' (default) and 'monthly' return the latest snapshot in each bucket.";

export const getNetWorthHistorySchema = {
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  granularity: z.enum(["daily", "weekly", "monthly"]).optional(),
};

type Args = {
  start_date: string;
  end_date: string;
  granularity?: "daily" | "weekly" | "monthly";
};

type SnapshotRow = {
  snapshot_date: string;
  balance: number;
  account_id: string;
  accounts: { type: string } | null;
};

export async function getNetWorthHistory(args: Args) {
  const granularity = args.granularity ?? "weekly";
  const supa = getSupabase();

  // Join accounts to know whether each balance should be treated as debt.
  const { data, error } = await supa
    .from("balance_snapshots")
    .select("snapshot_date, balance, account_id, accounts!inner(type)")
    .gte("snapshot_date", args.start_date)
    .lte("snapshot_date", args.end_date)
    .order("snapshot_date", { ascending: true });
  if (error) return err(`Database error: ${error.message}`);

  // Sum per-day net worth across accounts. Credit/loan balances flip sign.
  const perDay = new Map<string, number>();
  for (const row of (data ?? []) as unknown as SnapshotRow[]) {
    const type = row.accounts?.type;
    const signed =
      type === "credit" || type === "loan" ? -Number(row.balance) : Number(row.balance);
    perDay.set(row.snapshot_date, (perDay.get(row.snapshot_date) ?? 0) + signed);
  }

  const daily = Array.from(perDay.entries())
    .map(([date, net_worth]) => ({ date, net_worth: Number(net_worth.toFixed(2)) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  let points = daily;
  if (granularity !== "daily") {
    const bucketKey = (d: string) => {
      const dt = new Date(d);
      if (granularity === "monthly") {
        return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
      }
      // weekly: ISO week start (Monday)
      const day = dt.getUTCDay(); // 0=Sun
      const diff = (day + 6) % 7;
      const monday = new Date(dt);
      monday.setUTCDate(dt.getUTCDate() - diff);
      return monday.toISOString().slice(0, 10);
    };
    const byBucket = new Map<string, { date: string; net_worth: number }>();
    for (const p of daily) {
      const k = bucketKey(p.date);
      // Keep the latest day in the bucket as its representative.
      const prev = byBucket.get(k);
      if (!prev || prev.date < p.date) byBucket.set(k, p);
    }
    points = Array.from(byBucket.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  return ok({
    start_date: args.start_date,
    end_date: args.end_date,
    granularity,
    points,
    count: points.length,
  });
}
