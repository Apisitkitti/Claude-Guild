// redactSecrets: strip likely secrets from text BEFORE it is slimmed, stored, logged or broadcast.
// Pure (no I/O). Deliberately conservative toward NOT touching normal code: a secret is only replaced when it has a
// known token shape (sk-..., ghp_..., AKIA..., JWT, PEM block ...) or sits in an assignment whose key names a secret
// (`password=`, `export FOO_TOKEN=`, `"api_key": "..."`, `Authorization: Bearer ...`, `user:pass@host`).
// Plain code such as `const token = getToken()`, `token: string`, `max_tokens=4096`, git SHAs and base64-looking fixtures
// is left alone. Linear-time regexes only (no nested quantifiers); very long strings are cut to head + tail first.

export const REDACTED = "‹redacted›";
/** strings longer than this keep only their head and tail before redaction (bounds regex cost) */
export const MAX_REDACT_LEN = 40_000;
const SEAM = 64;
const MAX_DEPTH = 8;
const MAX_ITEMS = 200;

/** words that mark a key as holding a secret (the key must END with one of them, so `max_tokens` / `tokenizer` don't count) */
const TERM = String.raw`(?:password|passwd|passphrase|secret(?:[_-]?(?:access[_-]?)?key)?|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|auth[_-]?key|client[_-]?secret)`;

const PEM =
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|$)/g;

/** tokens with a distinctive shape: the whole token is replaced */
const TOKEN_SHAPES: RegExp[] = [
  /(?<![A-Za-z0-9])sk-ant-[A-Za-z0-9_-]{8,}/g,
  // digit required: keeps hyphenated words such as "sk-learn-pipeline-transformer" safe
  /(?<![A-Za-z0-9])sk-(?:proj-|svcacct-|live-|test-)?(?=[A-Za-z0-9_-]{0,200}\d)[A-Za-z0-9_-]{20,}/g,
  /(?<![A-Za-z0-9])[sr]k_(?:live|test)_[A-Za-z0-9]{10,}/g,
  /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{30,}/g,
  /(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{20,}/g,
  /(?<![A-Za-z0-9])glpat-[A-Za-z0-9_-]{20,}/g,
  /(?<![A-Za-z0-9])xox[abprs]-[A-Za-z0-9-]{10,}/g,
  /(?<![A-Za-z0-9])xapp-[A-Za-z0-9-]{10,}/g,
  /(?<![A-Za-z0-9])(?:AKIA|ASIA)[0-9A-Z]{16}(?![A-Za-z0-9])/g,
  /(?<![A-Za-z0-9])AIza[0-9A-Za-z_-]{35}(?![A-Za-z0-9_-])/g,
  /(?<![A-Za-z0-9])npm_[A-Za-z0-9]{36}(?![A-Za-z0-9])/g,
  /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g,
];

/** `Authorization: Bearer xxx` (also JSON / -H "..." forms): keep the prefix, drop the credential */
const AUTH_SCHEME = /(authorization["']?[ \t]*[:=][ \t]*["']?(?:bearer|basic|token|digest)[ \t]+)([^\s'"]+)/gi;
/** `Authorization: <opaque>` without a scheme (needs 16+ chars incl. a digit) */
const AUTH_BARE =
  /(authorization["']?[ \t]*:[ \t]*["']?)(?!(?:bearer|basic|token|digest)\b)((?=[A-Za-z0-9._~+/=-]{0,200}\d)[A-Za-z0-9._~+/=-]{16,})/gi;
/** a lone `Bearer <token>` (token needs 16+ chars incl. a digit, so prose like "Bearer authentication" is safe) */
const BEARER = /(?<![A-Za-z0-9])(bearer[ \t]+)((?=[A-Za-z0-9._~+/-]{0,200}\d)[A-Za-z0-9._~+/-]{16,}=*)/gi;

/** Cookie / Set-Cookie header values carry session tokens: mask the whole value */
const COOKIE = /(?<![A-Za-z0-9])((?:set-)?cookie["']?[ \t]*:[ \t]*["']?)([^\r\n"']+)/gi;
const URL_CREDS = /(?<![A-Za-z0-9])([a-z][a-z0-9+.-]{1,20}:\/\/[^\s:/@'"]+:)([^\s@/'"]+)(@)/gi;
const CURL_USER = /((?:^|[ \t])(?:-u|--user)(?:[ \t]+|=)['"]?[^\s:'"]+:)([^\s'"]+)/g;

/** KEY SEP VALUE where KEY ends with a secret word. Groups: 1 key, 2 closing key quote, 3 separator, 4 value */
const ASSIGN = new RegExp(
  String.raw`(?<![A-Za-z0-9])((?:--)?[A-Za-z0-9_.$-]{0,64}?${TERM})(?![A-Za-z0-9])(["']?)([ \t]*[=:][ \t]*|[ \t]+)("[^"\n]*"|'[^'\n]*'|[^\s'"&;|,)}\]]+)`,
  "gi",
);

const NULLISH = /^(?:null|none|nil|undefined|true|false|yes|no|0|1|string|number|boolean|any)$/i;
const TYPE_WORDS =
  /^(?:string|number|boolean|bool|any|unknown|object|required|optional|secret|str|int|float|bytes|void)$/i;
const DOTTED_REF = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/;
const REF_ROOTS =
  /^(?:this|self|props|opts|options|config|cfg|args|req|res|ctx|process|os|env|settings|params|window|document|input|data|user|state)\./i;

/** value that merely refers to another variable / command output instead of being a literal secret */
function isReference(v: string): boolean {
  if (!v) return true;
  const c = v[0];
  if (
    c === "$" ||
    c === "<" ||
    c === "%" ||
    c === "{" ||
    c === "[" ||
    c === "=" ||
    c === ">" ||
    c === "~" ||
    c === "@" ||
    c === "(" ||
    c === "`"
  )
    return true;
  if (v.includes("(") || v.includes("[")) return true;
  if (v.includes(REDACTED)) return true;
  if (NULLISH.test(v)) return true;
  if (DOTTED_REF.test(v) && (REF_ROOTS.test(v) || /(?:^|\.)env\b/i.test(v))) return true;
  return false;
}

function maskAssign(
  m: string,
  key: string,
  q: string,
  sep: string,
  val: string,
  offset: number,
  whole: string,
): string {
  const sepT = sep.trim();
  const quoted = val[0] === '"' || val[0] === "'";
  const quote = quoted ? val[0] : "";
  const inner = quoted ? val.slice(1, -1) : val;
  if (quoted && (inner === "" || val.length < 2 || val[val.length - 1] !== quote)) return m;
  const out = (v: string) => key + q + sep + (quoted ? quote + v + quote : v);
  if (sepT === "") {
    // `--password hunter2` / `--token "x y"` flag form only
    if (!key.startsWith("--") || (!quoted && val.startsWith("-"))) return m;
    return isReference(inner) ? m : out(REDACTED);
  }
  if (sepT === ":") {
    if (quoted) return isReference(inner) ? m : out(REDACTED); // "password": "x", password: 'x'
    // unquoted: only HTTP-header style keys (`X-Api-Key: abc`); `token: string` / `password: required` stay
    if (q !== "" || key.startsWith("--") || isReference(inner) || TYPE_WORDS.test(inner)) return m;
    if (key.includes("-")) return out(REDACTED);
    if (/^[A-Z][A-Z0-9_]*$/.test(key)) return out(REDACTED); // compose / env style: POSTGRES_PASSWORD: hunter2
    const ls = whole.lastIndexOf("\n", offset - 1) + 1;
    // YAML key at the start of a line: needs something secret-looking (a digit or symbol), so `token: Token` stays
    if (/^[ \t]*(?:-[ \t]+)?$/.test(whole.slice(ls, offset)) && (/\d/.test(inner) || /[^A-Za-z_]/.test(inner)))
      return out(REDACTED);
    return m;
  }
  if (sepT !== "=") return m;
  if (quoted) return isReference(inner) ? m : out(REDACTED);
  const spaced = /\s/.test(sep);
  if (isReference(inner)) return m;
  if (spaced) {
    // `const token = x` is code. Only a config-style line (`aws_secret_access_key = abc123...`) that begins with the key counts.
    const ls = whole.lastIndexOf("\n", offset - 1) + 1;
    if (!/^[ \t]*(?:export[ \t]+)?$/.test(whole.slice(ls, offset))) return m;
    if (!/\d/.test(inner) && !/[^A-Za-z0-9_]/.test(inner)) return m; // `token = next_token`
  }
  return out(REDACTED);
}

/** strings shorter than this cannot hold a secret worth redacting */
const MIN_REDACT_LENGTH = 6;

/** Replace likely secrets in `text` with ‹redacted›. Never throws; returns non-strings untouched. */
export function redactSecrets(text: string): string {
  if (typeof text !== "string" || text.length < MIN_REDACT_LENGTH) return text;
  let s = text;
  // keep head + tail; drop 64 chars either side of the seam so a secret cut in half leaves no readable half
  if (s.length > MAX_REDACT_LEN)
    s = s.slice(0, MAX_REDACT_LEN / 2 - SEAM) + "…" + s.slice(-(MAX_REDACT_LEN / 2 - SEAM));
  s = s.replace(PEM, REDACTED);
  s = s.replace(AUTH_SCHEME, (_m, p: string) => p + REDACTED);
  s = s.replace(AUTH_BARE, (_m, p: string) => p + REDACTED);
  s = s.replace(COOKIE, (_m, p: string) => p + REDACTED);
  s = s.replace(BEARER, (_m, p: string) => p + REDACTED);
  for (const re of TOKEN_SHAPES) s = s.replace(re, REDACTED);
  s = s.replace(URL_CREDS, (m, a: string, pw: string, at: string) =>
    pw[0] === "$" || pw[0] === "{" || pw.includes(REDACTED) ? m : a + REDACTED + at,
  );
  s = s.replace(CURL_USER, (m, a: string, pw: string) => (pw[0] === "$" || pw.includes(REDACTED) ? m : a + REDACTED));
  s = s.replace(ASSIGN, maskAssign);
  return s;
}

const SECRET_KEY = new RegExp(
  String.raw`^(?:[A-Za-z0-9_.$-]*?[_.$-])?(?:${TERM}|authorization|cookie|set-cookie)$`,
  "i",
);

/** an object key that names a secret (`api_key`, `GITHUB_TOKEN`, `authorization`) */
export function isSecretKey(k: string): boolean {
  return (
    SECRET_KEY.test(k) ||
    /^(?:password|passwd|secret|token|apikey|authorization|cookie)$/i.test(k) ||
    SECRET_KEY.test(k.replace(/([a-z])([A-Z])/g, "$1_$2"))
  );
}

/**
 * Deep copy of a hook payload with every string redacted and secret-named keys blanked. Bounded: depth <= 8,
 * <= 200 items per array / object; deeper values become "{…}". Non-plain values (functions, ...) become null.
 */
export function redactDeep(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return redactSecrets(value);
  if (value === null || typeof value !== "object")
    return typeof value === "function" || typeof value === "symbol" || typeof value === "bigint" ? null : value;
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? "[…]" : "{…}";
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((v) => redactDeep(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value).slice(0, MAX_ITEMS)) {
    out[k] = typeof v === "string" && v !== "" && isSecretKey(k) ? REDACTED : redactDeep(v, depth + 1);
  }
  return out;
}
