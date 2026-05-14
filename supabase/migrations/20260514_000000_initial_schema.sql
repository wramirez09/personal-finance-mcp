-- Accounts: linked bank, credit, and investment accounts
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  source text not null check (source in ('plaid', 'snaptrade')),
  name text not null,
  institution text,
  type text not null check (type in ('depository','credit','investment','loan','other')),
  subtype text,
  mask text,
  current_balance numeric,
  available_balance numeric,
  credit_limit numeric,
  currency text not null default 'USD',
  updated_at timestamptz not null default now(),
  unique(source, external_id)
);

-- Transactions: every line item from checking/credit accounts
-- Plaid convention: positive amount = outflow, negative = inflow
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  external_id text not null,
  amount numeric not null,
  date date not null,
  name text,
  merchant_name text,
  category text,
  subcategory text,
  pending boolean not null default false,
  created_at timestamptz not null default now(),
  unique(account_id, external_id)
);
create index if not exists idx_transactions_account_date on transactions(account_id, date desc);
create index if not exists idx_transactions_date on transactions(date desc);
create index if not exists idx_transactions_category on transactions(category);
create index if not exists idx_transactions_merchant on transactions(merchant_name);

-- Holdings: investment positions from brokerage/401k accounts
create table if not exists holdings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  symbol text,
  description text,
  quantity numeric,
  price numeric,
  market_value numeric,
  cost_basis numeric,
  currency text not null default 'USD',
  updated_at timestamptz not null default now()
);
create index if not exists idx_holdings_account on holdings(account_id);

-- Daily balance snapshots for net worth history
create table if not exists balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  balance numeric not null,
  snapshot_date date not null,
  unique(account_id, snapshot_date)
);
create index if not exists idx_snapshots_date on balance_snapshots(snapshot_date desc);
