#!/usr/bin/env node
// Print the guild token and ready-made join commands. Usage: node scripts/guild-token.mjs [--url <public base>] [--port N] [--rotate]
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
if (args.includes('--help')) { console.log('Usage: node scripts/guild-token.mjs [--url <public base>] [--port N] [--rotate]'); process.exit(0); }
const port = Number(opt('--port') ?? 5050);
let url = opt('--url');
if (url) {
  try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) throw 0; url = url.replace(/\/+$/, ''); }
  catch { console.error('error: invalid --url (need http(s)://host[:port])'); process.exit(1); }
}

// Same file the server reads (lib/guildAuth.ts): GUILD_TOKEN_FILE, else <project root>/.guild/token.
// The server runs from the project root (npm start), which is also the repo root derived here.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.env.GUILD_TOKEN_FILE?.trim() || path.join(root, '.guild', 'token');
function create() {
  const t = crypto.randomBytes(24).toString('base64url');
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dir, 0o700); } catch {}
  fs.writeFileSync(file, t + '\n', { mode: 0o600, flag: 'wx' }); // wx: never overwrite (EEXIST -> caller re-reads)
  return t;
}
function token() {
  if (process.env.GUILD_TOKEN?.trim()) return process.env.GUILD_TOKEN.trim();
  for (let i = 0; i < 3; i++) {
    try { const t = fs.readFileSync(file, 'utf8').trim(); if (t) return t; } catch {}
    try { return create(); } catch (e) { if (e?.code !== 'EEXIST') throw e; }
  }
  throw new Error('could not read or create ' + file);
}
if (args.includes('--rotate')) {
  if (process.env.GUILD_TOKEN?.trim()) { console.error('GUILD_TOKEN is set in the environment: change it there, then restart the server.'); process.exit(1); }
  fs.rmSync(file, { force: true });
  console.log('Token rotated. RESTART the server (stop it, then `npm run share` / `npm run start:lan`) so it picks up the new token; the old one stops working only after restart.\n');
}
const t = token();

const bases = url ? [url] : Object.values(os.networkInterfaces()).flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => `http://${i.address}:${port}`);

console.log('IMPORTANT: tunnel/share ONLY the production server (`npm run share`, or `npm run build && npm start`). NEVER expose `npm run dev` (its dev endpoints are not protected).\n');
console.log(`Guild token (keep secret, never post publicly):\n  ${t}\n`);
if (!bases.length) console.log('No LAN IPv4 address found; pass --url <public base>.\n');
for (const base of bases) {
  console.log(`== ${base} ==`);
  console.log(`Viewer link (opens once, sets a cookie):\n  ${base}/?token=${t}\n`);
  console.log(`Add the MCP server to Claude Code:\n  claude mcp add --transport http guild ${base}/mcp --header "Authorization: Bearer ${t}"\n`);
  console.log(`Send hooks to this guild (dry-run; add --apply):\n  node scripts/install-hooks.mjs --global --url ${base} --token ${t}\n`);
}
if (!url) console.log('Not on the same network? Run `npm run share`, then a tunnel (cloudflared tunnel --url http://localhost:' + port + ') or Tailscale and re-run with --url <public base>.\n');
console.log(`Suggested CLAUDE.md snippet for teammates:
---
## Claude Guild
- At the start of a session call guild_join({name: "<your-handle>", cwd: "<project dir>"}).
- Before editing a shared file, call who_holds({file, cwd}). If someone holds it, coordinate (shout) first.
- Claim files you edit with claim({name, files, cwd}) and call release({name}) when done.
---`);
