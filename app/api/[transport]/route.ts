import { createMcpHandler } from "mcp-handler";
import { withBearerAuth } from "@/lib/auth";

import { listAccounts, listAccountsDescription } from "@/lib/tools/list-accounts";
import {
  getTransactions,
  getTransactionsDescription,
  getTransactionsSchema,
} from "@/lib/tools/get-transactions";
import {
  getSpendingByCategory,
  getSpendingByCategoryDescription,
  getSpendingByCategorySchema,
} from "@/lib/tools/get-spending-by-category";
import {
  getHoldings,
  getHoldingsDescription,
  getHoldingsSchema,
} from "@/lib/tools/get-holdings";
import {
  getNetWorthHistory,
  getNetWorthHistoryDescription,
  getNetWorthHistorySchema,
} from "@/lib/tools/get-net-worth-history";
import {
  getCreditUtilization,
  getCreditUtilizationDescription,
} from "@/lib/tools/get-credit-utilization";

export const maxDuration = 60;

const baseHandler = createMcpHandler(
  (server) => {
    server.tool("list_accounts", listAccountsDescription, {}, async () => listAccounts());

    server.tool(
      "get_transactions",
      getTransactionsDescription,
      getTransactionsSchema,
      async (args) => getTransactions(args),
    );

    server.tool(
      "get_spending_by_category",
      getSpendingByCategoryDescription,
      getSpendingByCategorySchema,
      async (args) => getSpendingByCategory(args),
    );

    server.tool(
      "get_holdings",
      getHoldingsDescription,
      getHoldingsSchema,
      async (args) => getHoldings(args),
    );

    server.tool(
      "get_net_worth_history",
      getNetWorthHistoryDescription,
      getNetWorthHistorySchema,
      async (args) => getNetWorthHistory(args),
    );

    server.tool(
      "get_credit_utilization",
      getCreditUtilizationDescription,
      {},
      async () => getCreditUtilization(),
    );
  },
  { serverInfo: { name: "personal-finance-mcp", version: "0.1.0" } },
  { basePath: "/api", maxDuration: 60, disableSse: true },
);

const authed = withBearerAuth(baseHandler);

export { authed as GET, authed as POST, authed as DELETE };
