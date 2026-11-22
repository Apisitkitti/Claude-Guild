import { describe, expect, it } from "vitest";
import { REDACTED as R, isSecretKey, redactDeep, redactSecrets } from "@/lib/redact";

const fake = {
  sk: "sk-proj-abc123def456ghi789jkl012mno345",
  ant: "sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv",
  ghp: "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8",
  pat: "github_pat_11ABCDEFG0abcdefghijkl_mnopqrstuvwxyz",
  slack: "xoxb-1234567890-abcdefghijkl",
  aws: "AKIAIOSFODNN7EXAMPLE",
  jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r",
};

describe("redactSecrets: known token shapes", () => {
  it.each(Object.entries(fake))("redacts %s", (_n, tok) => {
    const out = redactSecrets(`run with ${tok} now`);
    expect(out).toBe(`run with ${R} now`);
    expect(out).not.toContain(tok);
  });
  it("redacts a PEM private key block, including a truncated one", () => {
    const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\nabcdef\n-----END RSA PRIVATE KEY-----";
    expect(redactSecrets(`cat > k <<EOF\n${pem}\nEOF`)).toBe(`cat > k <<EOF\n${R}\nEOF`);
    expect(redactSecrets("x\n-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg")).toBe(`x\n${R}`);
    expect(redactSecrets("-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----")).toBe(R);
  });
});

describe("redactSecrets: headers", () => {
  it("Authorization: Bearer (curl -H forms)", () => {
    expect(redactSecrets(`curl -H "Authorization: Bearer abc.def-123" https://x.io`)).toBe(`curl -H "Authorization: Bearer ${R}" https://x.io`);
    expect(redactSecrets("curl -H 'authorization: bearer s3cr3tvalue' u")).toBe(`curl -H 'authorization: bearer ${R}' u`);
    expect(redactSecrets(`{"Authorization":"Basic dXNlcjpwYXNz"}`)).toBe(`{"Authorization":"Basic ${R}"}`);
  });
  it("lone Bearer token with digits, not prose", () => {
    expect(redactSecrets("token was Bearer abcdef1234567890xyz in log")).toBe(`token was Bearer ${R} in log`);
    expect(redactSecrets("uses Bearer authentication over HTTPS")).toBe("uses Bearer authentication over HTTPS");
  });
  it("header-style key with colon", () => {
    expect(redactSecrets(`curl -H "X-Api-Key: abc123xyz" u`)).toBe(`curl -H "X-Api-Key: ${R}" u`);
  });
});

describe("redactSecrets: assignments", () => {
  it("password / token / secret / api_key = value", () => {
    expect(redactSecrets("psql password=hunter2 host=db")).toBe(`psql password=${R} host=db`);
    expect(redactSecrets("curl 'https://a.io/x?token=abc123&page=2'")).toBe(`curl 'https://a.io/x?token=${R}&page=2'`);
    expect(redactSecrets("SECRET=topsecret run")).toBe(`SECRET=${R} run`);
    expect(redactSecrets("api_key=zzz999 --foo")).toBe(`api_key=${R} --foo`);
    expect(redactSecrets("apiKey=Zq81x")).toBe(`apiKey=${R}`);
  });
  it("export FOO_TOKEN=... and quoted values", () => {
    expect(redactSecrets("export GITHUB_TOKEN=abc123XYZ && npm run x")).toBe(`export GITHUB_TOKEN=${R} && npm run x`);
    expect(redactSecrets(`DB_PASSWORD="my pass word" ./run`)).toBe(`DB_PASSWORD="${R}" ./run`);
    expect(redactSecrets("AWS_SECRET_ACCESS_KEY='wJalrXUtnFEMI/K7MDENG'")).toBe(`AWS_SECRET_ACCESS_KEY='${R}'`);
  });
  it("JSON / YAML style quoted literals", () => {
    expect(redactSecrets(`{"password": "hunter2", "user": "bob"}`)).toBe(`{"password": "${R}", "user": "bob"}`);
    expect(redactSecrets(`curl -d '{"token":"abc"}'`)).toBe(`curl -d '{"token":"${R}"}'`);
    expect(redactSecrets(`client_secret: 's3cret!'`)).toBe(`client_secret: '${R}'`);
  });
  it("config-style line starting with the key (spaced =)", () => {
    expect(redactSecrets("[default]\naws_secret_access_key = wJalrXUtnFEMI/K7MDENG\nregion = x")).toBe(`[default]\naws_secret_access_key = ${R}\nregion = x`);
  });
  it("flag form: --password x / --token=x", () => {
    expect(redactSecrets("mycli --password hunter2 --user bob")).toBe(`mycli --password ${R} --user bob`);
    expect(redactSecrets("mycli --token=abc123 go")).toBe(`mycli --token=${R} go`);
    expect(redactSecrets(`mycli --api-key "k 1" go`)).toBe(`mycli --api-key "${R}" go`);
  });
  it("URLs with user:pass@ and curl -u", () => {
    expect(redactSecrets("git clone https://bob:ghs3cret@github.com/a/b.git")).toBe(`git clone https://bob:${R}@github.com/a/b.git`);
    expect(redactSecrets("DATABASE_URL=postgres://app:p4ss@db:5432/x")).toBe(`DATABASE_URL=postgres://app:${R}@db:5432/x`);
    expect(redactSecrets("curl -u admin:hunter2 https://x")).toBe(`curl -u admin:${R} https://x`);
  });
  it("is idempotent", () => {
    const once = redactSecrets(`export A_TOKEN=abc123 ; curl -H "Authorization: Bearer xyz" https://u:p@h ${fake.ghp}`);
    expect(redactSecrets(once)).toBe(once);
    expect(once).not.toMatch(/abc123|xyz|ghp_/);
  });
});

describe("redactSecrets: no false positives", () => {
  const same = [
    "const token = getToken();",
    "const { token } = useAuth();",
    "let password = form.password;",
    "if (token == null) return;",
    "token = tokens[i]",
    "password = os.environ['PW']",
    "secret = process.env.SECRET",
    "token = next_token",
    "type Props = { token: string; password: string }",
    "password: required",
    "max_tokens=4096 temperature=0.2",
    "tokenizer=bert --tokens 12",
    "export PATH=$HOME/bin:$PATH",
    'echo "token=$TOKEN"',
    "TOKEN=$(cat ~/.token) ./run",
    "git rev-parse HEAD # 9fceb02d0ae598e95dc970b74767f19372d61af8",
    "commit 9fceb02d0ae598e95dc970b74767f19372d61af8 Author: x",
    "npm test -- --run tests/redact.test.ts",
    "git commit -m 'fix: handle sk-learn style names'",
    "import sk-learn-pipeline-transformer-name",
    "see https://example.com/docs/auth?page=2",
    "http://localhost:3000/events",
    "git@github.com:org/repo.git",
    "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC9 user@host",
    "fetch(url, { credentials: 'include' })",
    "const fixture = 'dGhpcyBpcyBhIHRlc3QgZml4dHVyZSBzdHJpbmc='",
    "Authorization header is required",
    "--password-file ./pw.txt",
    "grep -rn \"password\" src/",
    "short",
    "",
  ];
  it.each(same)("leaves %j untouched", (s) => {
    expect(redactSecrets(s)).toBe(s);
  });
});

describe("redactSecrets: bounds", () => {
  it("huge strings are cut to head+tail and still redacted", () => {
    const big = "a ".repeat(100_000) + `password=hunter2 ${fake.ghp}`;
    const out = redactSecrets(big);
    expect(out.length).toBeLessThan(45_000);
    expect(out).toContain(`password=${R}`);
    expect(out).not.toContain("hunter2");
  });
  it("runs fast on pathological input", () => {
    const t = Date.now();
    redactSecrets("-----BEGIN PRIVATE KEY-----".repeat(2000) + "token".repeat(5000) + "a-".repeat(20000));
    expect(Date.now() - t).toBeLessThan(2000);
  });
  it("non-strings pass through", () => {
    expect(redactSecrets(undefined as unknown as string)).toBeUndefined();
  });
});

describe("redactDeep / isSecretKey", () => {
  it("redacts nested strings and secret-named keys, keeps the rest", () => {
    const out = redactDeep({
      tool_name: "Bash",
      tool_input: { command: "export X_TOKEN=abc123 && ls", env: { GITHUB_TOKEN: "ghp_whatever", NODE_ENV: "test" }, n: 3, ok: true },
      todos: [{ content: "use password=hunter2", status: "completed" }],
      session_id: "s1",
      max_tokens: 100,
    }) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toMatch(/abc123|ghp_whatever|hunter2/);
    expect(out).toMatchObject({ tool_name: "Bash", session_id: "s1", max_tokens: 100 });
    expect((out.tool_input as { env: Record<string, unknown> }).env.NODE_ENV).toBe("test");
    expect((out.tool_input as { n: number }).n).toBe(3);
    expect((out.todos as { status: string }[])[0].status).toBe("completed");
  });
  it("bounds depth and item counts, never throws on cycles of depth", () => {
    let deep: unknown = "x";
    for (let i = 0; i < 20; i++) deep = { a: deep };
    expect(JSON.stringify(redactDeep(deep))).toContain("{…}");
    expect((redactDeep(Array.from({ length: 1000 }, (_, i) => i)) as unknown[]).length).toBe(200);
  });
  it("isSecretKey", () => {
    for (const k of ["token", "api_key", "GITHUB_TOKEN", "accessToken", "Authorization", "client_secret", "password", "x-api-key", "cookie"]) expect(isSecretKey(k)).toBe(true);
    for (const k of ["max_tokens", "session_id", "command", "file_path", "tokenizer", "tool_name", "key"]) expect(isSecretKey(k)).toBe(false);
  });
});

describe("review fixes", () => {
  const time = (s: string) => { const t = performance.now(); redactSecrets(s); return performance.now() - t; };
  it("adversarial 40k inputs stay fast", () => {
    const cases: Record<string, string> = {
      underscores: "_".repeat(40_000), dashA: "-a".repeat(20_000), dotA: ".a".repeat(20_000), xyU: "x.y_".repeat(10_000),
      sk: "sk-".repeat(13_000), tokenRun: "token".repeat(8000), bearer: "bearer " + "a".repeat(40_000), auth: "authorization: " + "a".repeat(40_000),
      cookie: "cookie:".repeat(5000), heredocish: "<<A\n".repeat(8000), eq: "token=".repeat(7000), urls: "a://b:".repeat(7000),
    };
    for (const [n, s] of Object.entries(cases)) expect(time(s), n).toBeLessThan(50);
  });
  it("a 1MB MultiEdit-shaped payload through redactDeep < 300ms", () => {
    const big = ("const a_b = 1; // password=hunter2 \n" + "x".repeat(60)).repeat(10_000);
    const payload = { tool_name: "MultiEdit", tool_input: { file_path: "/a", edits: Array.from({ length: 200 }, () => ({ old_string: big.slice(0, 5000), new_string: big.slice(0, 5000) })) }, junk: big };
    const t = performance.now();
    const out = redactDeep(payload);
    expect(performance.now() - t).toBeLessThan(300);
    expect(JSON.stringify(out)).not.toContain("hunter2");
  });
  it("YAML / compose / env style unquoted values", () => {
    expect(redactSecrets("environment:\n  POSTGRES_PASSWORD: hunter2\n  NODE_ENV: test")).toBe(`environment:\n  POSTGRES_PASSWORD: ${R}\n  NODE_ENV: test`);
    expect(redactSecrets("client_secret: abc123xyz")).toBe(`client_secret: ${R}`);
    expect(redactSecrets("  - api_key: k9x8")).toBe(`  - api_key: ${R}`);
    for (const ok of ["token: string", "password: required", "API_TOKEN: string", "token: Token;", "  token: number"]) expect(redactSecrets(ok), ok).toBe(ok);
  });
  it("Cookie / Set-Cookie header values", () => {
    expect(redactSecrets('curl -H "Cookie: sid=abc; theme=dark" u')).toBe(`curl -H "Cookie: ${R}" u`);
    expect(redactSecrets("Set-Cookie: session=xyz; HttpOnly")).toBe(`Set-Cookie: ${R}`);
    expect(redactSecrets("cookie consent banner")).toBe("cookie consent banner");
  });
  it("a secret straddling the head/tail cut leaves no readable half", () => {
    const tok = "ghp_" + "a1B2c3D4e5".repeat(4);
    const pad = "z ".repeat(10_000);
    const s = pad.slice(0, 20_000 - 20) + tok + pad.slice(0, 30_000);
    const out = redactSecrets(s);
    expect(out).not.toMatch(/ghp_|a1B2c3D4e5/);
  });
});
