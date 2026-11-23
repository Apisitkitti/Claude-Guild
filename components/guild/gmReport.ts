import type { GmReason } from "@/lib/office/engine";
import { m } from "@/paraglide/messages";

/** every reason the Guild Master can report, most urgent first (the engine sorts rows the same way) */
export const GM_REASONS: GmReason[] = ["permission", "question", "limit", "loop", "stuck", "idle", "compact"];

/** icon + wording of a report reason, in the viewer's language (call at render time, not at module load) */
export const gmReasonLabel = (reason: GmReason): string => {
  switch (reason) {
    case "permission":
      return m.gm_report_reason_permission();
    case "question":
      return m.gm_report_reason_question();
    case "limit":
      return m.gm_report_reason_limit();
    case "loop":
      return m.gm_report_reason_loop();
    case "stuck":
      return m.gm_report_reason_stuck();
    case "idle":
      return m.gm_report_reason_idle();
    case "compact":
      return m.gm_report_reason_compact();
  }
};
