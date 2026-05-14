import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export type Account = {
  id: string;
  external_id: string;
  source: "plaid" | "snaptrade";
  name: string;
  institution: string | null;
  type: "depository" | "credit" | "investment" | "loan" | "other";
  subtype: string | null;
  mask: string | null;
  current_balance: number | null;
  available_balance: number | null;
  credit_limit: number | null;
  currency: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  account_id: string;
  external_id: string;
  amount: number;
  date: string;
  name: string | null;
  merchant_name: string | null;
  category: string | null;
  subcategory: string | null;
  pending: boolean;
  created_at: string;
};

export type Holding = {
  id: string;
  account_id: string;
  symbol: string | null;
  description: string | null;
  quantity: number | null;
  price: number | null;
  market_value: number | null;
  cost_basis: number | null;
  currency: string;
  updated_at: string;
};

export type BalanceSnapshot = {
  id: string;
  account_id: string;
  balance: number;
  snapshot_date: string;
};
