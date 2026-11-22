#!/usr/bin/env node
// `npm run dev`: Paraglide in watch mode (recompiles messages/*.json on save) next to `next dev`.
// Turbopack cannot run Paraglide's bundler plugins, so the CLI does the compiling.
// The compile flags live in one place only: the `paraglide:watch` script in package.json.
import { spawn } from "node:child_process";

const PORT = "5050";
const HOST = "127.0.0.1";
const FIRST_COMPILE_TIMEOUT_MS = 30_000;
const COMPILED = /Successfully compiled/;
const bin = (name) => `node_modules/.bin/${name}${process.platform === "win32" ? ".cmd" : ""}`;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const watch = spawn(npm, ["run", "--silent", "paraglide:watch"], { stdio: ["ignore", "pipe", "inherit"] });
let next = null;

const startNext = () => {
  if (next) return;
  clearTimeout(timer);
  next = spawn(bin("next"), ["dev", "-p", PORT, "-H", HOST], { stdio: "inherit" });
  next.on("exit", (code, signal) => stop(code ?? (signal ? 1 : 0)));
};

const stop = (code) => {
  watch.kill();
  next?.kill();
  process.exit(code);
};

const timer = setTimeout(startNext, FIRST_COMPILE_TIMEOUT_MS);
watch.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  if (COMPILED.test(String(chunk))) startNext();
});
watch.on("exit", (code) => stop(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(0));
