"use client";

import { useRef } from "react";
import type { OfficeView } from "@/lib/office/engine";
import { Header } from "./guild/Header";
import { SidePanel } from "./guild/SidePanel";
import { Stage } from "./guild/Stage";
import { useCanvasScale } from "./guild/hooks/useCanvasScale";
import { useDataSource } from "./guild/hooks/useDataSource";
import { useDerivedView } from "./guild/hooks/useDerivedView";
import { useDocumentTitle } from "./guild/hooks/useDocumentTitle";
import { useKeyboardNav } from "./guild/hooks/useKeyboardNav";
import { useNotifications } from "./guild/hooks/useNotifications";
import { useNow } from "./guild/hooks/useNow";
import { useOfficeEngine } from "./guild/hooks/useOfficeEngine";
import { useFullscreen, usePanelCollapsed } from "./guild/hooks/usePanelState";
import { useRevealSelect } from "./guild/hooks/useRevealSelect";
import { useSessionFilter } from "./guild/hooks/useSessionFilter";

export default function OfficeApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  // null until the first live snapshot has been applied (baseline); shared by the data source and clash notifications
  const prevClashRef = useRef<Set<string> | null>(null);

  const { officeRef, view, mounted } = useOfficeEngine(canvasRef);
  const source = useDataSource(officeRef, mounted, prevClashRef);
  const { mode } = source;
  const { waiting, hiddenSet, conflicts, clashes, attention, receipts, bellN } = useDerivedView(view, mode);
  const filter = useSessionFilter(officeRef, mounted);
  const revealSelect = useRevealSelect(officeRef, filter.setFq);
  const jumpTo = useKeyboardNav(attention, view.selectedId, revealSelect);
  const notify = useNotifications({ officeRef, mode, view, waiting, clashes, prevClashRef, revealSelect });
  useDocumentTitle({ waitingN: waiting.length, clashN: clashes.length, bellN });
  const nowMs = useNow();
  const [collapsed, toggleCollapsed] = usePanelCollapsed();
  const [full, toggleFull] = useFullscreen(appRef);
  const scale = useCanvasScale(stageRef, officeRef);
  const treasury = (view as OfficeView & { treasury?: number }).treasury;

  return (
    <div className={`app${collapsed ? " collapsed" : ""}`} ref={appRef}>
      <Header
        mode={mode} conn={source.conn} note={source.note} treasury={treasury}
        paused={source.paused} speed={source.speed} notify={notify} full={full} collapsed={collapsed} officeRef={officeRef}
        onSwitchMode={source.switchMode} onTogglePause={source.togglePause} onSetSpeed={source.setSpeed}
        onToggleFull={toggleFull} onToggleCollapsed={toggleCollapsed}
      />
      <div className="main">
        <Stage canvasRef={canvasRef} stageRef={stageRef} scale={scale} officeRef={officeRef} />
        <SidePanel
          view={view} attention={attention} receipts={receipts} conflicts={conflicts} hiddenSet={hiddenSet}
          nowMs={nowMs} collapsed={collapsed} filter={filter} onJump={jumpTo} officeRef={officeRef}
        />
      </div>
    </div>
  );
}
