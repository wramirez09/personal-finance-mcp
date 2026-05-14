import { timingSafeEqual } from "node:crypto";

export function withBearerAuth(
  handler: (req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const token = process.env.MCP_BEARER_TOKEN;
    if (!token) {
      return json({ error: "Server misconfigured: MCP_BEARER_TOKEN unset" }, 500);
    }
    const got = req.headers.get("authorization") ?? "";
    const want = `Bearer ${token}`;
    const a = Buffer.from(got);
    const b = Buffer.from(want);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return json({ error: "Unauthorized" }, 401);
    }
    return handler(req);
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
