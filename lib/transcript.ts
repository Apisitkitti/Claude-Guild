// Reads the context-window usage of a Claude Code session from the tail of its transcript JSONL.
// Security: only files under <config dir>/projects/ ending in .jsonl are read; only numbers leave this module.
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export type ContextUsage = { used: number; limit: number; limitGuessed: boolean };
// `compacted`: the latest thing in the transcript is a compaction with no assistant usage after it yet.
export type ContextRead = ContextUsage | { compacted: true } | null;

const TAIL_BYTES = 256 * 1024;
const DEFAULT_LIMIT = 200_000;
const GUESSED_LIMIT = 1_000_000;

async function baseDir(): Promise<string | null> {
  try {
    const root = await realpath(process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), ".claude"));
    return path.join(root, "projects") + path.sep;
  } catch {
    return null;
  }
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

export async function readContext(transcriptPath: unknown): Promise<ContextRead> {
  try {
    if (typeof transcriptPath !== "string" || !transcriptPath || transcriptPath.includes("\0")) return null;
    const base = await baseDir();
    if (!base) return null;
    const real = await realpath(transcriptPath);
    if (!real.startsWith(base) || !real.endsWith(".jsonl")) return null;
    // O_NOFOLLOW + fstat on the handle: no check/open race on the path.
    const fh = await open(real, constants.O_RDONLY | constants.O_NOFOLLOW);
    let text: string;
    let offset: number;
    try {
      const st = await fh.stat();
      if (!st.isFile()) return null;
      const length = Math.min(st.size, TAIL_BYTES);
      offset = st.size - length;
      const buf = Buffer.alloc(length);
      const { bytesRead } = await fh.read(buf, 0, length, offset);
      text = buf.subarray(0, bytesRead).toString("utf8");
    } finally {
      await fh.close();
    }
    if (offset > 0) {
      const nl = text.indexOf("\n");
      if (nl < 0) return null;
      text = text.slice(nl + 1);
    }

    const lines = text.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      let obj: Record<string, unknown>;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      if (obj && typeof obj === "object" && ((obj.type === "system" && obj.subtype === "compact_boundary") || obj.isCompactSummary === true)) {
        return { compacted: true };
      }
      if (!obj || typeof obj !== "object" || obj.type !== "assistant" || obj.isSidechain === true) continue;
      const msg = obj.message as { model?: unknown; usage?: Record<string, unknown> } | undefined;
      if (!msg || typeof msg !== "object" || msg.model === "<synthetic>") continue;
      const u = msg.usage;
      if (!u || typeof u !== "object") continue;
      const used = num(u.input_tokens) + num(u.cache_read_input_tokens) + num(u.cache_creation_input_tokens);
      const envLimit = Number(process.env.CLAUDE_OFFICE_CTX_LIMIT);
      let limit = Number.isFinite(envLimit) && envLimit > 0 ? envLimit : DEFAULT_LIMIT;
      let limitGuessed = false;
      if (used > limit) {
        limit = GUESSED_LIMIT;
        limitGuessed = true;
      }
      return { used, limit, limitGuessed };
    }
    return null;
  } catch {
    return null;
  }
}
