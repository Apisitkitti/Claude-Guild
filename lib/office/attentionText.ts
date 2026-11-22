import { m } from "@/paraglide/messages";

import type { AttentionMsgRow } from "./engine";

type Wordable = Pick<AttentionMsgRow, "kind" | "stale" | "tool" | "target" | "count" | "error" | "tail" | "pct">;

const loopWhat = (r: Wordable) => (r.target ? `${r.tool ?? ""} ${r.target}`.trim() : (r.tool ?? ""));

/** one-line reason of a Lookout Bell row, in the viewer's language (the server sends data only) */
export function attentionText(r: Wordable): string {
  switch (r.kind) {
    case "permission":
      return r.stale ? m.queue_permission_stale() : m.queue_permission();
    case "loop":
      return m.queue_loop({ what: loopWhat(r), count: r.count ?? 0 });
    case "asked":
      return m.queue_asked();
    case "context":
      return m.queue_context({ pct: r.pct ?? 0 });
    case "done":
      return m.queue_done();
  }
}

/** the second line of a row: the error of a loop, the tail of a (guessed) question */
export function attentionDetail(r: Wordable): string | undefined {
  return (r.kind === "loop" ? r.error : r.kind === "asked" ? r.tail : undefined) || undefined;
}

/** loop rows only: a message the user can paste into the stuck session */
export function attentionCopy(r: Wordable): string | undefined {
  if (r.kind !== "loop") return undefined;
  const params = { cmd: r.target || r.tool || "", count: r.count ?? 0, error: r.error ?? "" };
  return r.error ? m.queue_copy_loop_error(params) : m.queue_copy_loop(params);
}
