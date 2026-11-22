import type { InternRow } from "@/lib/office/engine";
import { m } from "@/paraglide/messages";

const INTERN_CHIP: Record<InternRow["act"], { cls: string; label: () => string }> = {
  typing: { cls: "c-magic", label: () => m.intern_typing() },
  reading: { cls: "c-read", label: () => m.intern_reading() },
  idle: { cls: "c-grey", label: () => m.intern_idle() },
  handup: { cls: "c-seal pulse", label: () => m.intern_handup() },
};

export const InternList = ({ list }: { list: InternRow[] }) => {
  return (
    <ul className="interns">
      {list.map((i) => {
        const chip = INTERN_CHIP[i.act] ?? INTERN_CHIP.idle;
        const detail =
          i.act === "idle"
            ? i.detail
              ? m.intern_recent({ tool: i.tool, detail: i.detail })
              : ""
            : `${i.tool} ${i.detail}`;
        return (
          <li key={i.id} className={i.failed ? "fail" : ""} title={detail.trim()}>
            <span aria-hidden>🛡️</span>
            <b>{i.label}</b>
            <span className={`chip ${chip.cls}`}>{chip.label()}</span>
            <span className="idetail">{detail.trim()}</span>
            {i.count > 0 && (
              <span className="icount" title={m.intern_calls_title()}>
                ×{i.count}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
};
