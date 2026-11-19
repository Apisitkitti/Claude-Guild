#!/usr/bin/env node
// Merge claude-office hook entries into a Claude Code settings.json (dry-run by default).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HELP = `Usage: node scripts/install-hooks.mjs (--global | --project <dir> | --file <path>) [options]

Target (one required):
  --global           ~/.claude/settings.json
  --project <dir>    <dir>/.claude/settings.json
  --file <path>      explicit settings file

Options:
  --apply            actually write (default is dry-run). A backup
                     settings.json.bak-YYYYMMDD-HHMMSS is made first.
  --uninstall        remove only our curl hooks (localhost:<port>/events)
  --port N           use port N instead of 5050 in installed commands
  --url <base>       post to a remote guild host (e.g. https://xxx.trycloudflare.com)
                     instead of http://localhost:<port>
  --token <t>        guild token, sent as 'Authorization: Bearer <t>' (use with --url)
  --help             show this help
`;

const die = (m) => { console.error('error: ' + m); process.exit(1); };

function parseArgs(argv) {
  const o = { apply: false, uninstall: false, port: 5050, url: null, token: null };
  const targets = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { const v = argv[++i]; if (!v || v.startsWith('--')) die(`${a} needs a value`); return v; };
    if (a === '--help' || a === '-h') { console.log(HELP); process.exit(0); }
    else if (a === '--apply') o.apply = true;
    else if (a === '--uninstall') o.uninstall = true;
    else if (a === '--global') targets.push(path.join(os.homedir(), '.claude', 'settings.json'));
    else if (a === '--project') targets.push(path.join(path.resolve(val()), '.claude', 'settings.json'));
    else if (a === '--file') targets.push(path.resolve(val()));
    else if (a === '--port') {
      const p = Number(val());
      if (!Number.isInteger(p) || p < 1 || p > 65535) die('invalid --port');
      o.port = p;
    } else if (a === '--url') {
      const u = val();
      try { const x = new URL(u); if (!/^https?:$/.test(x.protocol)) throw new Error('protocol'); o.url = u.replace(/\/+$/, ''); } catch { die('invalid --url (need http(s)://host[:port])'); }
    } else if (a === '--token') {
      o.token = val();
      if (!/^[A-Za-z0-9_.~+\/=-]+$/.test(o.token)) die('invalid --token characters');
    } else die(`unknown argument ${a}\n\n${HELP}`);
  }
  if (targets.length !== 1) die(`exactly one of --global, --project, --file is required\n\n${HELP}`);
  if (o.token && !o.url) die('--token requires --url');
  o.file = targets[0];
  return o;
}

// Ours: a curl posting to .../events (local default, or a remote guild installed with --url).
const isOurs = (cmd, target) => {
  if (typeof cmd !== 'string' || !cmd.includes('/events')) return false;
  if (target == null) return /localhost:\d+\/events/.test(cmd) || /curl .*--data-binary @- \S+\/events\b/.test(cmd);
  return cmd.includes(`${target}/events`);
};
const targetOf = (o) => (o.url ?? `http://localhost:${o.port}`);

const hookCmds = (group) => (Array.isArray(group?.hooks) ? group.hooks : []).map((h) => h?.command);

function stamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const o = parseArgs(process.argv.slice(2));

let settings = {};
let existed = fs.existsSync(o.file);
if (existed) {
  const raw = fs.readFileSync(o.file, 'utf8');
  if (raw.trim() !== '') {
    try { settings = JSON.parse(raw); } catch (e) { die(`${o.file} is not valid JSON (${e.message}). Nothing written.`); }
    if (settings === null || typeof settings !== 'object' || Array.isArray(settings)) die(`${o.file} must contain a JSON object. Nothing written.`);
  }
}
if (settings.hooks !== undefined && (settings.hooks === null || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks))) die('"hooks" in target is not an object. Nothing written.');

const log = [];
if (!o.uninstall) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const examplePath = path.resolve(here, '..', 'hooks', 'settings.example.json');
  let example;
  try { example = JSON.parse(fs.readFileSync(examplePath, 'utf8')); } catch (e) { die(`cannot read ${examplePath}: ${e.message}`); }
  for (const [event, groups] of Object.entries(example.hooks ?? {})) {
    const existing = settings.hooks?.[event];
    if (existing !== undefined && !Array.isArray(existing)) die(`hooks.${event} in target is not an array. Nothing written.`);
    if ((existing ?? []).some((g) => hookCmds(g).some((c) => isOurs(c, targetOf(o))))) {
      log.push(`  = ${event}: already installed, skipped`);
      continue;
    }
    let add = JSON.parse(JSON.stringify(groups).replace(/http:\/\/localhost:\d+/g, targetOf(o)));
    if (o.token) {
      add = JSON.parse(JSON.stringify(add).replace(/-H 'Content-Type: application\/json'/g, `-H 'Content-Type: application/json' -H 'Authorization: Bearer ${o.token}'`));
    }
    settings.hooks ??= {};
    settings.hooks[event] = [...(existing ?? []), ...add];
    log.push(`  + ${event}: add ${add.length} matcher group(s)${add[0]?.matcher ? ` (matcher ${add[0].matcher})` : ''}`);
  }
} else {
  for (const event of Object.keys(settings.hooks ?? {})) {
    const groups = settings.hooks[event];
    if (!Array.isArray(groups)) continue;
    let removed = 0;
    const kept = [];
    for (const g of groups) {
      if (!Array.isArray(g?.hooks)) { kept.push(g); continue; }
      const hooks = g.hooks.filter((h) => !isOurs(h?.command, null));
      removed += g.hooks.length - hooks.length;
      if (hooks.length === g.hooks.length) kept.push(g);
      else if (hooks.length > 0) kept.push({ ...g, hooks });
    }
    if (!removed) continue;
    if (kept.length) settings.hooks[event] = kept; else delete settings.hooks[event];
    log.push(`  - ${event}: removed ${removed} hook command(s)${kept.length ? '' : ', event now empty (dropped)'}`);
  }
  if (settings.hooks && Object.keys(settings.hooks).length === 0) delete settings.hooks;
}

const changed = log.some((l) => /^  [+-]/.test(l));
console.log(`${o.apply ? 'APPLY' : 'DRY-RUN'} ${o.uninstall ? 'uninstall' : 'install'} -> ${o.file}${existed ? '' : ' (does not exist yet)'}`);
console.log(log.length ? log.join('\n') : '  (no hooks to process)');
if (!changed) { console.log('Nothing to change.'); process.exit(0); }
if (!o.apply) { console.log('\nDry-run only. Re-run with --apply to write.'); process.exit(0); }

fs.mkdirSync(path.dirname(o.file), { recursive: true });
if (existed) {
  const bak = `${o.file}.bak-${stamp()}`;
  fs.copyFileSync(o.file, bak);
  console.log(`Backup: ${bak}`);
}
fs.writeFileSync(o.file, JSON.stringify(settings, null, 2) + '\n');
console.log('Written.');
