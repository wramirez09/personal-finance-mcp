# personal-finance-mcp

Remote MCP server (Next.js App Router on Vercel) exposing personal financial
data from Supabase as tools. Single-user, read-only, bearer-token auth.

## Stack

- Next.js 15 (App Router) + TypeScript, Node 20+
- [`mcp-handler`](https://github.com/vercel/mcp-handler) — Vercel's adapter wrapping `@modelcontextprotocol/sdk` Streamable HTTP transport
- `@supabase/supabase-js` (server-side, service role)
- `zod` for input validation

**Why Next.js + `mcp-handler`:** Vercel's officially supported path for remote
MCP. Runs stateless on serverless (fresh `McpServer` per request, no Redis).
Endpoint is exposed at `/api/mcp` via the dynamic `[transport]` segment.

## Env vars

See [.env.example](./.env.example). All three are required:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, bypasses RLS
- `MCP_BEARER_TOKEN` — generate with `openssl rand -base64 32`

## Endpoints

- `GET /health` — unauthenticated liveness probe (`{ "status": "ok" }`)
- `GET|POST|DELETE /api/mcp` — MCP Streamable HTTP transport, bearer-auth

## Connecting from Claude

Claude.ai's web connector UI requires OAuth, which this server does not
implement. Use the [`mcp-remote`](https://www.npmjs.com/package/mcp-remote)
bridge from Claude Desktop instead:

```json
{
  "mcpServers": {
    "personal-finance": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://<your-deploy>.vercel.app/api/mcp",
        "--header",
        "Authorization:Bearer ${MCP_BEARER_TOKEN}"
      ],
      "env": { "MCP_BEARER_TOKEN": "<token>" }
    }
  }
}
```
