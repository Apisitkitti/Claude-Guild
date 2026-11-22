import type { ReactNode } from "react";

/** Collapsible section heading; the body (with id `sec-<id>`) is rendered by the caller. */
export function SectionHeading({ id, hidden, onToggle, children, count }: { id: string; hidden: boolean; onToggle: () => void; children: ReactNode; count?: number }) {
  return (
    <h2>
      <button className="sec" onClick={onToggle} aria-expanded={!hidden} aria-controls={`sec-${id}`}>
        {hidden ? "▸" : "▾"} {children}{count !== undefined && <> <small>({count})</small></>}
      </button>
    </h2>
  );
}
