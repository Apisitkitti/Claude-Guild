import { m } from "@/paraglide/messages";

import type { AttentionMsgRow } from "./engine";

type Wordable = Pick<
  AttentionMsgRow,
  "kind" | "stale" | "tool" | "target" | "count" | "error" | "tail" | "pct" | "detail"
>;

const loopWhat = (row: Wordable) => (row.target ? `${row.tool ?? ""} ${row.target}`.trim() : (row.tool ?? ""));

/** one-line reason of a Lookout Bell row, in the viewer's language (the server sends data only) */
export const attentionText = (row: Wordable): string => {
  switch (row.kind) {
    case "permission":
      return row.stale ? m.queue_permission_stale() : m.queue_permission();
    case "loop":
      return m.queue_loop({ what: loopWhat(row), count: row.count ?? 0 });
    case "asked":
      return m.queue_asked();
    case "context":
      return m.queue_context({ pct: row.pct ?? 0 });
    case "limit":
      return m.queue_limit();
    case "done":
      return m.queue_done();
  }
};

/** the second line of a row: the error of a loop, the tail of a (guessed) question */
export const attentionDetail = (row: Wordable): string | undefined => {
  if (row.kind === "limit") return (row.detail ? m.queue_limit_reset({ time: row.detail }) : undefined) || undefined;
  return (row.kind === "loop" ? row.error : row.kind === "asked" ? row.tail : undefined) || undefined;
};

/** loop rows only: a message the user can paste into the stuck session */
export const attentionCopy = (row: Wordable): string | undefined => {
  if (row.kind !== "loop") return undefined;
  const params = { cmd: row.target || row.tool || "", count: row.count ?? 0, error: row.error ?? "" };
  return row.error ? m.queue_copy_loop_error(params) : m.queue_copy_loop(params);
};
