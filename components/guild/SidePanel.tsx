import type { ConflictRow, OfficeView, AttentionRow, ReceiptRow } from "@/lib/office/engine";

import { AttentionQueue } from "./AttentionQueue";
import { usePersistedFlags } from "./hooks/usePersistedFlags";
import type { SessionFilter } from "./hooks/useSessionFilter";
import { QuestLog } from "./QuestLog";
import { ReceiptList } from "./ReceiptList";
import { Roster } from "./Roster";
import { TerritoryList } from "./TerritoryList";
import type { OfficeRef } from "./types";

export const SidePanel = ({
  view,
  attention,
  receipts,
  conflicts,
  hiddenSet,
  nowMs,
  collapsed,
  filter,
  onJump,
  officeRef,
}: {
  view: OfficeView;
  attention: AttentionRow[];
  receipts: ReceiptRow[];
  conflicts: ConflictRow[];
  hiddenSet: Set<string>;
  nowMs: number;
  collapsed: boolean;
  filter: SessionFilter;
  onJump: (sid: string) => void;
  officeRef: OfficeRef;
}) => {
  const [secHidden, toggleSec] = usePersistedFlags("office.sectionsHidden");
  return (
    <aside className="panel" hidden={collapsed}>
      <AttentionQueue
        rows={attention}
        now={nowMs}
        selectedId={view.selectedId}
        hidden={!!secHidden.attn}
        onToggle={() => toggleSec("attn")}
        onJump={onJump}
        officeRef={officeRef}
      />
      <ReceiptList
        rows={receipts}
        now={nowMs}
        selectedId={view.selectedId}
        hidden={!!secHidden.rcpt}
        onToggle={() => toggleSec("rcpt")}
        onJump={onJump}
      />
      <Roster
        view={view}
        filter={filter}
        hidden={!!secHidden.roster}
        onToggle={() => toggleSec("roster")}
        officeRef={officeRef}
      />
      <TerritoryList
        conflicts={conflicts}
        hidden={!!secHidden.terr}
        onToggle={() => toggleSec("terr")}
        officeRef={officeRef}
      />
      <QuestLog log={view.log} hiddenSet={hiddenSet} hidden={!!secHidden.log} onToggle={() => toggleSec("log")} />
    </aside>
  );
};
