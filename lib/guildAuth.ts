import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Access control for the guild. Local requests (loopback Host, no proxy/tunnel headers) need no token.
// With GUILD_REQUIRE_TOKEN=1 nothing is local: every request needs the token.
// Anything else (LAN, Tailscale, tunnels such as cloudflared/ngrok) needs the guild token, either as
// `Authorization: Bearer <token>` or as the HttpOnly `guild_token` cookie set by visiting `/?token=<token>`.

export const COOKIE_NAME = "guild_token";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
// Headers that only a proxy/tunnel adds. Next.js itself fills x-forwarded-for/host/proto/port on EVERY request
// (from the socket and the Host header), so those count as remote only when they point somewhere non-loopback.
const PROXY_ONLY = new Set(["x-real-ip", "forwarded", "true-client-ip", "via", "x-original-host", "x-forwarded-server"]);
const LOOPBACK_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** GUILD_REQUIRE_TOKEN=1 disables local trust entirely (use when binding 0.0.0.0: a LAN peer can fake `Host: localhost`). */
export const requireToken = () => /^(1|true|yes)$/i.test(process.env.GUILD_REQUIRE_TOKEN?.trim() ?? "");

/** Token file: GUILD_TOKEN_FILE, else <project root>/.guild/token (the server runs from the project root; scripts/guild-token.mjs resolves the same path). */
export function tokenFile(): string {
  return process.env.GUILD_TOKEN_FILE?.trim() || path.join(process.cwd(), ".guild", "token");
}

let cached: string | null = null;

export function getGuildToken(): string {
  const env = process.env.GUILD_TOKEN?.trim();
  if (env) return env;
  if (cached) return cached;
  const file = tokenFile();
  const dir = path.dirname(file);
  try {
    const t = fs.readFileSync(file, "utf8").trim();
    if (t) return (cached = t);
  } catch {}
  const t = crypto.randomBytes(24).toString("base64url");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dir, 0o700); } catch {}
  try {
    fs.writeFileSync(file, t + "\n", { mode: 0o600, flag: "wx" });
  } catch {
    // lost a race with another process: use whatever won
    try {
      const w = fs.readFileSync(file, "utf8").trim();
      if (w) return (cached = w);
    } catch {}
  }
  return (cached = t);
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

function hostnameOf(host: string | null): string {
  return (host ?? "").replace(/:\d+$/, "").toLowerCase();
}

export function hasProxyHeaders(headers: Headers): boolean {
  for (const [k, v] of headers) {
    const n = k.toLowerCase();
    if (PROXY_ONLY.has(n) || n.startsWith("cf-") || n.startsWith("ngrok-")) return true;
    if (n === "x-forwarded-for") {
      for (const ip of v.split(",")) if (!LOOPBACK_IPS.has(ip.trim().toLowerCase())) return true;
    } else if (n === "x-forwarded-host") {
      for (const h of v.split(",")) if (!LOCAL_HOSTNAMES.has(hostnameOf(h.trim()))) return true;
    }
  }
  return false;
}

/** True only for a loopback Host with no forwarding/tunnel header. Host alone never grants trust. */
export function isLocalRequest(headers: Headers): boolean {
  if (requireToken()) return false;
  return LOCAL_HOSTNAMES.has(hostnameOf(headers.get("host"))) && !hasProxyHeaders(headers);
}

function readCookie(headers: Headers, name: string): string | null {
  const raw = headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function validToken(candidate: string | null | undefined): boolean {
  return !!candidate && safeEqual(candidate, getGuildToken());
}

export function bearerOf(headers: Headers): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(headers.get("authorization") ?? "");
  return m ? m[1] : null;
}

function originOk(headers: Headers, remote: boolean): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;
  let oh: string;
  try {
    oh = new URL(origin).host;
  } catch {
    return false;
  }
  const allowed = [headers.get("host")];
  if (remote) allowed.push(headers.get("x-forwarded-host")); // tunnels may rewrite Host
  return allowed.some((h) => !!h && h.toLowerCase() === oh.toLowerCase());
}

export type Access = { ok: true; remote: boolean } | { ok: false; status: number; reason: string };

export function authorize(req: Request): Access {
  const h = req.headers;
  const local = isLocalRequest(h);
  if (local) return originOk(h, false) ? { ok: true, remote: false } : { ok: false, status: 403, reason: "forbidden" };
  if (!validToken(bearerOf(h)) && !validToken(readCookie(h, COOKIE_NAME))) return { ok: false, status: 403, reason: "forbidden" };
  if (!originOk(h, true)) return { ok: false, status: 403, reason: "forbidden" };
  return { ok: true, remote: true };
}

/** Response to send when access is denied, or null when the request may proceed. */
export function guard(req: Request): Response | null {
  const a = authorize(req);
  return a.ok ? null : new Response(a.reason, { status: a.status });
}

export function isHttps(headers: Headers): boolean {
  return (headers.get("x-forwarded-proto") ?? "").split(",")[0].trim().toLowerCase() === "https";
}

export function tokenCookie(headers: Headers): string {
  return `${COOKIE_NAME}=${getGuildToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${isHttps(headers) ? "; Secure" : ""}`;
}
