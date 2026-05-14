Build, deploy, and connect a personal finance MCP server. This is a single project from empty directory to working Claude.ai connector. Work through the phases in order. Pause for me when you need a secret or a decision.

# Project overview

A remote MCP server in TypeScript that exposes my personal financial data (stored in Supabase) as tools. Single-user (me), read-only, bearer-token auth. Deployed on Vercel, connected to Claude.ai as a custom connector so I can chat with my financial data.

**Out of scope:** Plaid/SnapTrade ingestion (separate project), write operations, multi-user/OAuth, frontend UI.

# Known context

- **GitHub repo:** `https://github.com/wramirez09/personal-finance-mcp.git` (already exists, currently empty or near-empty — push to `main`)
- **Supabase project:** "Finances MCP"
  - Project ID: `iefvkjztiwbwohlchbeg`
  - URL: `https://iefvkjztiwbwohlchbeg.supabase.co`
  - Region: us-east-2
- **Target deploy:** Vercel production, auto-deploy on push to `main`

# Stack requirements

- TypeScript, Node 20+, pnpm or npm (your call — pick one and stick with it)
- Official MCP TypeScript SDK: `@modelcontextprotocol/sdk`. **Before writing any server code, check https://modelcontextprotocol.io for the current Streamable HTTP transport pattern.** The spec has evolved — build against current docs, not memory. If anything in this prompt conflicts with current docs, follow the docs and tell me what you adjusted.
- `@supabase/supabase-js` server-side with the service role key
- Zod for input validation on every tool
- Deploy target: Vercel. Use whichever structure (Next.js App Router route handler, or standalone Node server with `vercel.json`) the current MCP SDK best supports for remote HTTP transport. Document the choice and why in the README.
- Auth: bearer token from `MCP_BEARER_TOKEN` env var, validated on every request before any tool dispatch. No OAuth.

# Database schema (you will apply this)

```sql
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
```

# Tools to implement

Every tool: clear `description` field (Claude reads these to decide when to call which tool — be precise), Zod input schema, structured JSON response (not pre-formatted prose). Surface useful errors back to Claude rather than silent empties where it matters.

1. **`list_accounts`** — no params. Returns all accounts with current balances, type/subtype, institution, mask, and (for credit cards) credit_limit and computed utilization.

2. **`get_transactions`** — params: `start_date` (required, YYYY-MM-DD), `end_date` (required), `category?`, `merchant?` (substring match on merchant_name, case-insensitive), `min_amount?`, `max_amount?`, `account_id?`. Returns up to 200 most recent matching transactions; include `truncated: true` if more exist.

3. **`get_spending_by_category`** — params: `start_date`, `end_date`, `account_id?`. Returns category totals sorted descending plus grand total. Excludes inflows (only counts positive amounts per Plaid convention).

4. **`get_holdings`** — params: `account_id?`. Returns current holdings with symbol, description, quantity, price, market_value, cost_basis, unrealized gain/loss (market_value - cost_basis), and total portfolio value across returned holdings.

5. **`get_net_worth_history`** — params: `start_date`, `end_date`, `granularity?` ('daily' | 'weekly' | 'monthly', default 'weekly'). Returns net worth at each interval from balance_snapshots, summed across accounts. Treat credit account balances as negative (debt) when computing net worth.

6. **`get_credit_utilization`** — no params. Returns per-card utilization (current_balance / credit_limit) as a percentage, overall utilization across all credit cards, total available credit, and total balance owed.

# Phases

Work through these in order. After each phase, print a clear `=== Phase N complete ===` marker so I can follow along.

## Phase 1 — Scaffold

1. `cd` into the cloned repo directory. Verify `git remote -v` shows the GitHub URL above. If the repo is empty, that's fine.
2. Initialize the project (package.json, tsconfig.json, framework setup per the stack requirements above).
3. Set up `.gitignore` to exclude `.env*`, `node_modules`, `.vercel`, `dist`, `.next` (if Next.js), and any other build artifacts.
4. Create `.env.example` listing required env vars with descriptions but no values:
```
   SUPABASE_URL=
   SUPABASE_SERVICE_ROLE_KEY=
   MCP_BEARER_TOKEN=
```
5. Create `.env.local` for dev (not committed). Leave values empty for now — we'll fill in Phase 4.
6. Install dependencies: MCP SDK, `@supabase/supabase-js`, `zod`, and framework deps.
7. Commit and push: `chore: project scaffold`

## Phase 2 — Build the MCP server

1. Implement the MCP server with Streamable HTTP transport per current SDK docs.
2. Bearer token middleware: reject requests without `Authorization: Bearer <MCP_BEARER_TOKEN>` with a 401. Constant-time string compare.
3. Implement all six tools listed above. Each tool function should:
   - Validate input with Zod
   - Query Supabase via the typed client
   - Return structured JSON
   - Catch DB errors and return them as readable error responses (don't leak stack traces)
4. Service role key is server-side only — never log it, never include it in error messages.
5. Add a basic health endpoint (no auth required) at `/health` or equivalent that returns `{ status: "ok" }`. Useful for smoke tests.
6. Write tool descriptions carefully. Example for `get_transactions`: "Retrieve transactions from linked bank and credit card accounts. Use this when the user asks about spending, charges, deposits, specific merchants, or any transaction-level question. Filter by date range, category, merchant name, amount, or account. Returns up to 200 most recent matches." Bad descriptions are the #1 reason MCP tools don't get called.
7. Commit and push: `feat: implement MCP server with six finance tools`

## Phase 3 — Apply the database schema

1. Pick the right approach for this repo:
   - If using Supabase CLI / migrations folder: create `supabase/migrations/<timestamp>_initial_schema.sql` with the schema above. Stop and tell me to run `supabase db push` myself (so I'm authenticated). Don't run it for me.
   - If not using Supabase CLI: save the schema as `scripts/schema.sql`. Stop and tell me to paste it into the SQL editor at `https://supabase.com/dashboard/project/iefvkjztiwbwohlchbeg/sql/new`.
2. Commit and push: `feat: add database schema`
3. **Wait for me to confirm the schema is applied before continuing to Phase 4.**

## Phase 4 — Local dev verification

1. Generate a strong bearer token: run `openssl rand -base64 32` and print the output. Tell me to save it in 1Password — I'll use it locally now and in Vercel later.
2. Prompt me for my Supabase service role key. Tell me to grab it from `https://supabase.com/dashboard/project/iefvkjztiwbwohlchbeg/settings/api-keys` → `service_role` (the secret one, not anon/publishable). When I paste it back, write it to `.env.local` along with the bearer token and `SUPABASE_URL=https://iefvkjztiwbwohlchbeg.supabase.co`. **Do not echo the service role key back to me, do not commit `.env.local`, do not log it.**
3. Insert a couple of test rows so the tools return non-empty results. Suggest this SQL for me to run (don't run it yourself — print and have me execute):
```sql
   insert into accounts (external_id, source, name, institution, type, subtype, mask, current_balance, credit_limit, currency)
   values 
     ('test-checking-1', 'plaid', 'Test Checking', 'Test Bank', 'depository', 'checking', '1234', 5000.00, null, 'USD'),
     ('test-cc-1', 'plaid', 'Test Credit Card', 'Test Bank', 'credit', 'credit_card', '5678', 1500.00, 10000.00, 'USD');
   
   insert into transactions (account_id, external_id, amount, date, name, merchant_name, category)
   select id, 'tx-1', 45.32, current_date - 3, 'Whole Foods', 'Whole Foods', 'Groceries' from accounts where external_id = 'test-checking-1'
   union all
   select id, 'tx-2', 12.50, current_date - 1, 'Starbucks', 'Starbucks', 'Coffee Shops' from accounts where external_id = 'test-cc-1';
```
4. Run the server locally. Smoke test with curl:
   - GET `/health` returns `{status: "ok"}`
   - POST to the MCP endpoint **without** bearer token returns 401
   - POST to the MCP endpoint **with** bearer token can list tools
   - Calling `list_accounts` returns the two test accounts
   - Calling `get_transactions` with a wide date range returns the two test transactions
5. Print each curl command and its response so I can see it worked. If anything fails, stop and debug before continuing.

## Phase 5 — Deploy to Vercel

1. Install Vercel CLI if missing (`npm i -g vercel`). Prompt me to run `vercel login` myself.
2. Run `vercel link` to associate the directory with a new Vercel project named `personal-finance-mcp`. Link it to the GitHub repo so future pushes to `main` auto-deploy.
3. Set production env vars one at a time using `vercel env add <NAME> production`:
   - `SUPABASE_URL` = `https://iefvkjztiwbwohlchbeg.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = the value from Phase 4 (re-prompt me if it's not in your memory; don't read it from `.env.local` and echo it)
   - `MCP_BEARER_TOKEN` = the value from Phase 4
4. Run `vercel --prod` to trigger a production deployment.
5. Capture the production URL from the output.

## Phase 6 — Production smoke test

1. Hit `<production-url>/health` — should return `{status: "ok"}`.
2. POST to the production MCP endpoint without bearer token — should return 401.
3. POST with bearer token, call `list_accounts` — should return the two test accounts inserted in Phase 4.
4. If any step fails, run `vercel logs <production-url>` to inspect, fix, push, and re-test before continuing.

## Phase 7 — Final handoff

Print a summary with:
- Production URL
- Exact MCP endpoint path to use in Claude.ai (e.g., `https://personal-finance-mcp.vercel.app/mcp` — whatever path your server actually exposes)
- Reminder that secrets live in Vercel env vars + my password manager, not in git
- Step-by-step for connecting in Claude.ai:
  1. Open Claude.ai → Settings → Connectors → Add custom connector
  2. Paste the MCP endpoint URL
  3. Authentication: Bearer
  4. Paste the `MCP_BEARER_TOKEN` value
  5. Save, then open a new chat and verify the tools show up
- One example question I can ask to verify end-to-end: "What accounts do I have?" — should call `list_accounts` and return the two test accounts.
- Note that real data will land once the separate Plaid + SnapTrade ingestion project is built.

# Universal rules

- **Never commit secrets.** Bearer token, service role key, and any other credentials go only into Vercel env vars and `.env.local`. Both are gitignored.
- **Never echo secrets back to me unnecessarily.** Once I've given you a service role key, store it in env files and use it; don't print it back in chat or logs.
- **Pause when you need auth or a secret.** Don't be clever about Vercel login or Supabase credentials — just ask.
- **If the current MCP SDK docs contradict this prompt, follow the docs and tell me what you adjusted.** The transport spec has been evolving.
- **If anything in the repo or environment is ambiguous, stop and show me what you found before guessing.**
- **Commit at the end of each phase** with a clear conventional commit message. Push after every commit so we have a recoverable state if something breaks.

Go. Start with Phase 1.

A few things to know before you run it:

It will stop and wait for you several times — when applying the schema, when you paste the Supabase service role key, when you run vercel login, and when it generates the bearer token. That's deliberate. Don't let it skip those.
The service_role key warning is real — Supabase's dashboard puts it behind a "reveal" prompt for a reason. It bypasses row-level security, so anything that has it can read/write the entire database. Pasting it once into Vercel env vars and never again is the right pattern.
If Claude Code finishes Phase 6 successfully but the Claude.ai connection in Phase 7 fails, the usual culprit is the endpoint path. Different MCP SDK versions expose the server at different paths (/mcp, /sse, /api/mcp, etc.). Check the README it writes and the Vercel function routes — the path needs to match exactly in the Claude.ai connector config.