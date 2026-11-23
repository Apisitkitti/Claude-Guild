"use client";

import { useRef } from "react";

import type { OfficeView } from "@/lib/office/engine";

import { Header } from "./guild/Header";
import { useCanvasScale } from "./guild/hooks/useCanvasScale";
import { useDataSource } from "./guild/hooks/useDataSource";
import { useDerivedView } from "./guild/hooks/useDerivedView";
import { useDocumentTitle } from "./guild/hooks/useDocumentTitle";
import { useKeyboardNav } from "./guild/hooks/useKeyboardNav";
import { useLocale } from "./guild/hooks/useLocale";
import { useNotifications } from "./guild/hooks/useNotifications";
import { useNow } from "./guild/hooks/useNow";
import { useOfficeEngine } from "./guild/hooks/useOfficeEngine";
import { useFullscreen, usePanelCollapsed } from "./guild/hooks/usePanelState";
import { useRevealSelect } from "./guild/hooks/useRevealSelect";
import { useSessionFilter } from "./guild/hooks/useSessionFilter";
import { useSound } from "./guild/hooks/useSound";
import { SidePanel } from "./guild/SidePanel";
import { Stage } from "./guild/Stage";

const OfficeApp = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  // null until the first live snapshot has been applied (baseline); shared by the data source and clash notifications
  const prevClashRef = useRef<Set<string> | null>(null);

  useLocale(); // first, so every message below is already in the viewer's language when the engine starts
  const { officeRef, view, mounted } = useOfficeEngine(canvasRef);
  const source = useDataSource(officeRef, mounted, prevClashRef);
  const { waiting, hiddenSet, conflicts, clashes, attention, receipts, bellN } = useDerivedView(view, source.mode);
  const filter = useSessionFilter(officeRef, mounted);
  const revealSelect = useRevealSelect(officeRef, filter.setFilterQuery);
  const jumpTo = useKeyboardNav(attention, view.selectedId, revealSelect);
  const notify = useNotifications({ officeRef, mode: source.mode, view, waiting, clashes, prevClashRef, revealSelect });
  const sound = useSound(officeRef);
  useDocumentTitle({ waitingN: waiting.length, clashN: clashes.length, bellN });
  const nowMs = useNow();
  const [collapsed, toggleCollapsed] = usePanelCollapsed();
  const [full, toggleFull] = useFullscreen(appRef);
  const scale = useCanvasScale(stageRef, officeRef);
  const { mode } = source;
  const treasury = (view as OfficeView & { treasury?: number }).treasury;

  return (
    <div className={`app${collapsed ? " collapsed" : ""}`} ref={appRef}>
      <Header
        mode={mode}
        conn={source.conn}
        note={source.note}
        treasury={treasury}
        paused={source.paused}
        speed={source.speed}
        notify={notify}
        sound={sound}
        full={full}
        collapsed={collapsed}
        officeRef={officeRef}
        onSwitchMode={source.switchMode}
        onTogglePause={source.togglePause}
        onSetSpeed={source.setSpeed}
        onToggleFull={toggleFull}
        onToggleCollapsed={toggleCollapsed}
      />
      <div className="main">
        <Stage
          canvasRef={canvasRef}
          stageRef={stageRef}
          scale={scale}
          officeRef={officeRef}
          dungeon={view.dungeon}
          quests={view.quests ?? []}
          viewScene={view.scene}
          viewFloor={view.dungeonFloor}
        />
        <SidePanel
          view={view}
          attention={attention}
          receipts={receipts}
          conflicts={conflicts}
          hiddenSet={hiddenSet}
          nowMs={nowMs}
          collapsed={collapsed}
          filter={filter}
          onJump={jumpTo}
          officeRef={officeRef}
        />
      </div>
    </div>
  );
};

export default OfficeApp;
