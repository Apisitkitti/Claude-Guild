import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Hosts allowed to load dev assets (extend with GUILD_DEV_ORIGINS=host1,host2). Tunnel wildcards are deliberately NOT listed:
  // never expose `next dev` through a tunnel (its dev endpoints are ungated); share `npm run share` (production server) instead.
  allowedDevOrigins: process.env.GUILD_DEV_ORIGINS?.split(",").map((x) => x.trim()).filter(Boolean) ?? [],
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
