import type { InternRow } from "@/lib/office/engine";

const INTERN_CHIP: Record<InternRow["act"], { cls: string; label: string }> = {
  typing: { cls: "c-magic", label: "ร่ายเวท" },
  reading: { cls: "c-read", label: "อ่าน" },
  idle: { cls: "c-grey", label: "ว่าง" },
  handup: { cls: "c-seal pulse", label: "ต้องการคุณ ❗" },
};

export function InternList({ list }: { list: InternRow[] }) {
  return (
    <ul className="interns">
      {list.map((i) => {
        const chip = INTERN_CHIP[i.act] ?? INTERN_CHIP.idle;
        const detail = i.act === "idle" ? (i.detail ? `เพิ่งทำ: ${i.tool} ${i.detail}` : "") : `${i.tool} ${i.detail}`;
        return (
          <li key={i.id} className={i.failed ? "fail" : ""} title={detail.trim()}>
            <span aria-hidden>🛡️</span>
            <b>{i.label}</b>
            <span className={`chip ${chip.cls}`}>{chip.label}</span>
            <span className="idetail">{detail.trim()}</span>
            {i.count > 0 && <span className="icount" title="tool calls">×{i.count}</span>}
          </li>
        );
      })}
    </ul>
  );
}
