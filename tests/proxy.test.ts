import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

process.env.GUILD_TOKEN = "proxy-token";

describe("proxy dev-endpoint gate (non-production)", () => {
  it("denies remote requests to /_next/mcp and /__nextjs*, allows local", async () => {
    const { proxy } = await import("@/proxy");
    const mk = (path: string, headers: Record<string, string>) => new NextRequest("http://localhost:5050" + path, { headers: { host: "localhost:5050", ...headers } });
    for (const p of ["/_next/mcp", "/_next/mcp/x", "/__nextjs_launch-editor", "/__nextjs_source-map"]) {
      expect(proxy(mk(p, { "cf-connecting-ip": "1.1.1.1", authorization: "Bearer proxy-token" })).status, p).toBe(403);
      expect(proxy(mk(p, {})).status, p).toBe(200);
    }
  });
  it("page: remote needs token, ?token sets a Lax cookie and redirects", async () => {
    const { proxy } = await import("@/proxy");
    const h = { host: "g.example.com", "x-forwarded-proto": "https" };
    expect(proxy(new NextRequest("https://g.example.com/", { headers: h })).status).toBe(403);
    const r = proxy(new NextRequest("https://g.example.com/?token=proxy-token", { headers: h }));
    expect(r.status).toBe(303);
    expect(r.headers.get("set-cookie")).toContain("SameSite=Lax");
  });
});
