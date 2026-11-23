// Reads the context-window usage of a Claude Code session from the tail of its transcript JSONL.
// Security: only files under <config dir>/projects/ ending in .jsonl are read; only numbers leave this module.
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { BYTES_PER_KB } from "@/lib/constants";
import { sanitizeModel } from "@/lib/rateLimit";

/** `model`: latest real assistant model. `rateLimit`: the newest line is a synthetic rate_limit error (text may be null). */
export type ContextUsage = {
  used: number;
  limit: number;
  limitGuessed: boolean;
  model?: string;
  rateLimit?: { text: string | null; at: number | null };
};
// `compacted`: the latest thing in the transcript is a compaction with no assistant usage after it yet.
export type ContextRead = ContextUsage | { compacted: true } | null;

const TAIL_BYTES_KB = 256;
const TAIL_BYTES = TAIL_BYTES_KB * BYTES_PER_KB;
const DEFAULT_LIMIT = 200_000;
const GUESSED_LIMIT = 1_000_000;
const HTTP_TOO_MANY_REQUESTS = 429;

const baseDir = async (): Promise<string | null> => {
  try {
    const root = await realpath(process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), ".claude"));
    return path.join(root, "projects") + path.sep;
  } catch {
    return null;
  }
};

const positiveNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

const isRateLimitError = (line: Record<string, unknown>): boolean =>
  line.error === "rate_limit" || line.apiErrorStatus === HTTP_TOO_MANY_REQUESTS;

export const readContext = async (transcriptPath: unknown): Promise<ContextRead> => {
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
      const fileStat = await fh.stat();
      if (!fileStat.isFile()) return null;
      const length = Math.min(fileStat.size, TAIL_BYTES);
      offset = fileStat.size - length;
      const buf = Buffer.alloc(length);
      const { bytesRead } = await fh.read(buf, 0, length, offset);
      text = buf.subarray(0, bytesRead).toString("utf8");
    } finally {
      await fh.close();
    }
    if (offset > 0) {
      const newline = text.indexOf("\n");
      if (newline < 0) return null;
      text = text.slice(newline + 1);
    }

    const lines = text.split("\n");
    let limited: { text: string | null; at: number | null } | undefined; // newest synthetic rate_limit error, before any user / real line
    let blocked = false; // a user or real assistant line is newer than anything older: older errors are history
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      let obj: Record<string, unknown>;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      if (
        obj &&
        typeof obj === "object" &&
        ((obj.type === "system" && obj.subtype === "compact_boundary") || obj.isCompactSummary === true)
      ) {
        return { compacted: true };
      }
      if (obj && typeof obj === "object" && obj.type === "user" && obj.isSidechain !== true) blocked = true;
      if (!obj || typeof obj !== "object" || obj.type !== "assistant" || obj.isSidechain === true) continue;
      const msg = obj.message as { model?: unknown; usage?: Record<string, unknown>; content?: unknown } | undefined;
      if (!msg || typeof msg !== "object") continue;
      if (msg.model === "<synthetic>") {
        if (!blocked && !limited && obj.isApiErrorMessage === true && isRateLimitError(obj)) {
          const first = Array.isArray(msg.content) ? (msg.content[0] as { text?: unknown } | undefined) : undefined;
          const stamp = typeof obj.timestamp === "string" ? Date.parse(obj.timestamp) : NaN;
          limited = {
            text: typeof first?.text === "string" ? first.text : null,
            at: Number.isFinite(stamp) ? stamp : null,
          };
        }
        continue;
      }
      blocked = true;
      const usage = msg.usage;
      if (!usage || typeof usage !== "object") continue;
      const used =
        positiveNumber(usage.input_tokens) +
        positiveNumber(usage.cache_read_input_tokens) +
        positiveNumber(usage.cache_creation_input_tokens);
      const envLimit = Number(process.env.CLAUDE_OFFICE_CTX_LIMIT);
      let limit = Number.isFinite(envLimit) && envLimit > 0 ? envLimit : DEFAULT_LIMIT;
      let limitGuessed = false;
      if (used > limit) {
        limit = GUESSED_LIMIT;
        limitGuessed = true;
      }
      const model = sanitizeModel(msg.model);
      return {
        used,
        limit,
        limitGuessed,
        ...(model ? { model } : {}),
        ...(limited ? { rateLimit: limited } : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
};
