import { beforeAll, describe, expect, it } from "vitest";

process.env.GUILD_TOKEN = "test-token-abc123";
const TOKEN = "test-token-abc123";

let A: typeof import("@/lib/guildAuth");
beforeAll(async () => {
  A = await import("@/lib/guildAuth");
});

const req = (headers: Record<string, string>) => new Request("http://x/events", { headers });
const ok = (h: Record<string, string>) => A.authorize(req(h)).ok;

describe("guildAuth", () => {
  it("local host passes without token", () => {
    expect(ok({ host: "localhost:5050" })).toBe(true);
    expect(ok({ host: "127.0.0.1:5050" })).toBe(true);
    expect(ok({ host: "localhost:5050", origin: "http://localhost:5050" })).toBe(true);
  });
  it("local host with foreign origin is rejected", () => {
    expect(ok({ host: "localhost:5050", origin: "http://evil.example" })).toBe(false);
  });
  it("non-local host needs a token", () => {
    expect(ok({ host: "192.168.1.5:5050" })).toBe(false);
    expect(ok({ host: "192.168.1.5:5050", authorization: "Bearer wrong" })).toBe(false);
    expect(ok({ host: "192.168.1.5:5050", authorization: "Bearer " + TOKEN })).toBe(true);
    expect(ok({ host: "192.168.1.5:5050", authorization: "bearer " + TOKEN })).toBe(true);
  });
  it("cookie works", () => {
    expect(ok({ host: "g.example.com", cookie: `a=b; guild_token=${TOKEN}` })).toBe(true);
    expect(ok({ host: "g.example.com", cookie: "guild_token=nope" })).toBe(false);
  });
  it("cross-origin with a valid token is forbidden; same origin ok", () => {
    expect(ok({ host: "g.example.com", authorization: "Bearer " + TOKEN, origin: "https://evil.example" })).toBe(false);
    expect(ok({ host: "g.example.com", authorization: "Bearer " + TOKEN, origin: "https://g.example.com" })).toBe(true);
  });
  it("tunnel: local Host + forwarding headers is remote", () => {
    for (const h of ["cf-connecting-ip", "cf-ray", "x-forwarded-for", "x-forwarded-host", "x-real-ip", "forwarded", "true-client-ip", "ngrok-skip-browser-warning"]) {
      expect(ok({ host: "localhost:5050", [h]: "1.2.3.4" }), h).toBe(false);
      expect(ok({ host: "localhost:5050", [h]: "1.2.3.4", authorization: "Bearer " + TOKEN }), h).toBe(true);
    }
    expect(ok({ host: "localhost:5050", "x-forwarded-for": "127.0.0.1, 1.2.3.4" })).toBe(false);
  });
  it("the x-forwarded-* headers Next.js adds to every local request stay local", () => {
    expect(ok({ host: "localhost:5050", "x-forwarded-for": "::1", "x-forwarded-host": "localhost:5050", "x-forwarded-proto": "http", "x-forwarded-port": "5050" })).toBe(true);
    expect(ok({ host: "127.0.0.1:5050", "x-forwarded-for": "127.0.0.1", "x-forwarded-host": "127.0.0.1:5050", "x-forwarded-proto": "http" })).toBe(true);
  });
  it("tunnel origin may match x-forwarded-host", () => {
    expect(ok({ host: "localhost:5050", "x-forwarded-host": "a.trycloudflare.com", origin: "https://a.trycloudflare.com", authorization: "Bearer " + TOKEN })).toBe(true);
  });
  it("guard returns a 403 response", () => {
    expect(A.guard(req({ host: "10.0.0.2" }))?.status).toBe(403);
    expect(A.guard(req({ host: "localhost" }))).toBeNull();
  });
  it("cookie flags: Secure only over https", () => {
    const c = A.tokenCookie(new Headers({ "x-forwarded-proto": "https" }));
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Secure");
    expect(A.tokenCookie(new Headers())).not.toContain("Secure");
  });
  it("safeEqual handles length mismatch", () => {
    expect(A.safeEqual("a", "ab")).toBe(false);
    expect(A.safeEqual("ab", "ab")).toBe(true);
  });
  it("GUILD_REQUIRE_TOKEN disables local trust", () => {
    process.env.GUILD_REQUIRE_TOKEN = "1";
    try {
      expect(ok({ host: "localhost:5050" })).toBe(false);
      expect(ok({ host: "127.0.0.1:5050", "x-forwarded-for": "::1" })).toBe(false);
      expect(ok({ host: "localhost:5050", authorization: "Bearer " + TOKEN })).toBe(true);
      expect(ok({ host: "localhost:5050", cookie: `guild_token=${TOKEN}` })).toBe(true);
      expect(A.isLocalRequest(new Headers({ host: "localhost" }))).toBe(false);
    } finally {
      delete process.env.GUILD_REQUIRE_TOKEN;
    }
    expect(ok({ host: "localhost:5050" })).toBe(true);
  });
  it("token file honours GUILD_TOKEN_FILE, default is under the project root", () => {
    expect(A.tokenFile().endsWith("/.guild/token")).toBe(true);
    process.env.GUILD_TOKEN_FILE = "/x/y/token";
    try { expect(A.tokenFile()).toBe("/x/y/token"); } finally { delete process.env.GUILD_TOKEN_FILE; }
  });
});
