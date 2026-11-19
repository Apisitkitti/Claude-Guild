import { describe, expect, it } from "vitest";
import { store } from "@/lib/store";
import { MAX_MEMBERS, claim, guildJoin, guildLeave, guildStatus, release, shout, whoHolds } from "@/lib/mcp/tools";

const j = (r: { text: string }) => JSON.parse(r.text);
const CWD = "/work/proj";

describe("guild MCP tools", () => {
  it("rejects bad names and inputs", () => {
    for (const name of ["Bad Name", "UPPER", "x".repeat(25), "", "a/b"]) expect(guildJoin({ name }).ok).toBe(false);
    expect(claim({ name: "ok-name", files: [] }).ok).toBe(false);
    expect(claim({ name: "ok-name", files: Array(21).fill("a.ts") }).ok).toBe(false);
    expect(shout({ name: "ok-name", message: "x".repeat(141) }).ok).toBe(false);
  });

  it("join creates a session; leave ends it", () => {
    const r = guildJoin({ name: "t-join", project: "demo", cwd: CWD });
    expect(r.ok).toBe(true);
    expect(store.sessions.has("mcp-t-join")).toBe(true);
    expect(guildStatus().text).toContain("t-join");
    expect(guildLeave({ name: "t-join" }).ok).toBe(true);
    expect(store.sessions.has("mcp-t-join")).toBe(false);
  });

  it("claim, who_holds, conflicts, release", () => {
    guildJoin({ name: "t-a", cwd: CWD });
    guildJoin({ name: "t-b", cwd: CWD });
    const c1 = j(claim({ name: "t-a", files: ["src/x.ts"], cwd: CWD }));
    expect(c1.claimed).toEqual(["src/x.ts"]);
    expect(c1.conflicts).toEqual([]);
    const h = j(whoHolds({ file: "src/x.ts", cwd: CWD }));
    expect(h.holders.map((x: { who: string }) => x.who)).toEqual(["t-a"]);
    const c2 = j(claim({ name: "t-b", files: ["src/x.ts", "node_modules/y.js"], cwd: CWD }));
    expect(c2.conflicts[0].heldBy[0]).toContain("t-a");
    expect(c2.skipped.files).toEqual(["node_modules/y.js"]);
    expect(store.territory.snapshot().conflicts.some((c) => c.level === "overlap" && c.file === "src/x.ts")).toBe(true);
    expect(release({ name: "t-a", files: ["src/x.ts"], cwd: CWD }).ok).toBe(true);
    const h2 = j(whoHolds({ file: "src/x.ts", cwd: CWD }));
    expect(h2.holders.some((x: { who: string; kind: string }) => x.who === "t-a" && x.kind.startsWith("claims"))).toBe(false);
    expect(release({ name: "t-b" }).ok).toBe(true);
    expect(store.territory.snapshot().claims.some((c) => c.sid === "mcp-t-b")).toBe(false);
    guildLeave({ name: "t-a" });
    guildLeave({ name: "t-b" });
  });

  it("shout strips control chars", () => {
    const r = j(shout({ name: "t-s", message: "hi\u0007 there\nteam" }));
    expect(r.shouted).toBe("hi there team");
    guildLeave({ name: "t-s" });
  });

  it("release for unknown member fails", () => {
    expect(release({ name: "nobody-here" }).ok).toBe(false);
  });
});

describe("mcp route", () => {
  it("initialize then tools/list, and auth gate", async () => {
    process.env.GUILD_TOKEN = "route-token";
    const { POST, GET } = await import("@/app/mcp/route");
    const mk = (body: unknown, headers: Record<string, string> = {}) =>
      new Request("http://localhost:5050/mcp", {
        method: "POST",
        headers: { host: "localhost:5050", "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
        body: JSON.stringify(body),
      });
    const init = await POST(mk({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } } }));
    expect(init.status).toBe(200);
    expect((await init.json()).result.serverInfo.name).toBe("claude-guild");
    const list = await POST(mk({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
    const names = (await list.json()).result.tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(["claim", "guild_join", "guild_leave", "guild_status", "release", "shout", "who_holds"]);
    const call = await POST(mk({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "guild_join", arguments: { name: "t-route" } } }));
    expect((await call.json()).result.isError).toBe(false);
    guildLeave({ name: "t-route" });
    // tunnel-style request without token
    const denied = await POST(mk({ jsonrpc: "2.0", id: 4, method: "tools/list" }, { "cf-connecting-ip": "1.1.1.1" }));
    expect(denied.status).toBe(403);
    const allowed = await POST(mk({ jsonrpc: "2.0", id: 5, method: "tools/list" }, { "cf-connecting-ip": "1.1.1.1", authorization: "Bearer route-token" }));
    expect(allowed.status).toBe(200);
    expect((await GET(new Request("http://localhost:5050/mcp", { headers: { host: "localhost:5050" } }))).status).toBe(405);
  });
});

describe("guild MCP hardening", () => {
  it("claim then release without cwd uses the cwd from join", () => {
    guildJoin({ name: "t-cwd", cwd: CWD });
    expect(j(claim({ name: "t-cwd", files: ["src/q.ts"] })).claimed).toEqual(["src/q.ts"]);
    expect(store.territory.snapshot().claims.some((c) => c.sid === "mcp-t-cwd")).toBe(true);
    expect(j(release({ name: "t-cwd", files: ["src/q.ts"] })).released).toEqual(["src/q.ts"]);
    expect(store.territory.snapshot().claims.some((c) => c.sid === "mcp-t-cwd")).toBe(false);
    guildLeave({ name: "t-cwd" });
  });

  it("relative paths without any cwd are rejected; absolute are fine", () => {
    guildJoin({ name: "t-nocwd" });
    const r = claim({ name: "t-nocwd", files: ["src/a.ts"] });
    expect(r.ok).toBe(false);
    expect(r.text).toContain("cwd");
    expect(release({ name: "t-nocwd", files: ["src/a.ts"] }).ok).toBe(false);
    expect(whoHolds({ file: "src/a.ts" }).ok).toBe(false);
    expect(claim({ name: "t-nocwd", files: ["/abs/dir/a.ts"] }).ok).toBe(true);
    expect(whoHolds({ file: "/abs/dir/a.ts" }).ok).toBe(true);
    guildLeave({ name: "t-nocwd" });
  });

  it("explicit cwd overrides the stored one", () => {
    guildJoin({ name: "t-ov", cwd: "/work/one" });
    expect(j(claim({ name: "t-ov", files: ["a.ts"], cwd: "/work/two" })).claimed).toEqual(["a.ts"]);
    expect(store.territory.snapshot().claims.find((c) => c.sid === "mcp-t-ov")?.files).toEqual(["a.ts"]);
    expect(release({ name: "t-ov", files: ["a.ts"], cwd: "/work/two" }).ok).toBe(true);
    expect(store.territory.snapshot().claims.some((c) => c.sid === "mcp-t-ov")).toBe(false);
    guildLeave({ name: "t-ov" });
  });

  it("shouts appear in guild_status (last 10)", () => {
    for (let i = 0; i < 12; i++) shout({ name: "t-sh", message: `msg ${i}` });
    const st = j(guildStatus());
    expect(st.shouts).toHaveLength(10);
    expect(st.shouts.at(-1)).toMatchObject({ who: "t-sh", message: "msg 11" });
    expect(st.shouts[0].message).toBe("msg 2");
    guildLeave({ name: "t-sh" });
  });

  it("caps MCP members", () => {
    const names: string[] = [];
    for (let i = 0; i < MAX_MEMBERS + 5; i++) {
      const n = `cap-${i}`;
      names.push(n);
      const r = guildJoin({ name: n });
      const existing = [...store.sessions.keys()].filter((k) => k.startsWith("mcp-")).length;
      expect(existing).toBeLessThanOrEqual(MAX_MEMBERS);
      if (!r.ok) {
        expect(r.text).toContain("full");
        expect(claim({ name: n, files: ["/a/b.ts"] }).ok).toBe(false);
        expect(shout({ name: n, message: "hi" }).ok).toBe(false);
        break;
      }
    }
    expect([...store.sessions.keys()].filter((k) => k.startsWith("mcp-")).length).toBe(MAX_MEMBERS);
    for (const n of names) guildLeave({ name: n });
  });
});

describe("routes hardening", () => {
  it("/mcp rejects bodies over 256KB with 413", async () => {
    process.env.GUILD_TOKEN = "route-token";
    const { POST } = await import("@/app/mcp/route");
    const big = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", pad: "x".repeat(300 * 1024) });
    const h = { host: "localhost:5050", "content-type": "application/json", accept: "application/json, text/event-stream" };
    expect((await POST(new Request("http://localhost:5050/mcp", { method: "POST", headers: h, body: big }))).status).toBe(413);
    // without content-length the stream limit still applies
    const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(big)); c.close(); } });
    const r = await POST(new Request("http://localhost:5050/mcp", { method: "POST", headers: h, body: stream, duplex: "half" } as RequestInit));
    expect(r.status).toBe(413);
  });

  it("remote POST /events cannot use mcp- session ids; local and normal ids still work", async () => {
    process.env.GUILD_TOKEN = "route-token";
    const { POST } = await import("@/app/events/route");
    const mk = (sid: string, headers: Record<string, string>) =>
      new Request("http://localhost:5050/events", { method: "POST", headers: { host: "localhost:5050", "content-type": "application/json", ...headers }, body: JSON.stringify({ session_id: sid, hook_event_name: "SessionStart" }) });
    const remote = { "cf-connecting-ip": "1.1.1.1", authorization: "Bearer route-token" };
    expect((await POST(mk("mcp-forged", remote))).status).toBe(403);
    expect(store.sessions.has("mcp-forged")).toBe(false);
    expect((await POST(mk("remote-ok-1", remote))).status).toBe(204);
    expect((await POST(mk("mcp-local-ok", {}))).status).toBe(204);
    store.sessions.delete("remote-ok-1");
    store.sessions.delete("mcp-local-ok");
  });
});
