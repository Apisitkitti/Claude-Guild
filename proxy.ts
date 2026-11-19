import { NextResponse, type NextRequest } from "next/server";
import { authorize, isLocalRequest, tokenCookie, validToken } from "@/lib/guildAuth";

// Gate for the page itself. Remote visitors open `/?token=<token>` once: we set the cookie and redirect without the token.
const DEV_ONLY = /^\/(_next\/mcp|__nextjs)(?:[/_?#-]|$)/;
export function proxy(req: NextRequest) {
  // Defense in depth: `next dev` exposes ungated dev endpoints (/_next/mcp, /__nextjs_*). Never serve them to non-local callers.
  // (Never tunnel `next dev` anyway: share the production server only.)
  if (process.env.NODE_ENV !== "production" && DEV_ONLY.test(req.nextUrl.pathname)) {
    return isLocalRequest(req.headers) ? NextResponse.next() : new NextResponse("forbidden", { status: 403 });
  }
  if (req.nextUrl.pathname !== "/") return NextResponse.next();
  if (isLocalRequest(req.headers)) return NextResponse.next();
  const q = req.nextUrl.searchParams.get("token");
  if (validToken(q)) {
    const proto = (req.headers.get("x-forwarded-proto") ?? "http").split(",")[0].trim() === "https" ? "https" : "http";
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost";
    const res = NextResponse.redirect(new URL("/", `${proto}://${host}`), 303);
    res.headers.set("Set-Cookie", tokenCookie(req.headers));
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  const a = authorize(req);
  if (!a.ok) return new NextResponse("forbidden", { status: a.status });
  return NextResponse.next();
}

export const config = { matcher: ["/", "/_next/mcp/:path*", "/__nextjs(.*)"] };
