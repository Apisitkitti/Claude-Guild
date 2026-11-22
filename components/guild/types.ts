import type { RefObject } from "react";
import type { Office, RosterRow } from "@/lib/office/engine";

export type Mode = "live" | "demo";
export type Conn = "connecting" | "connected" | "reconnecting";

/** Shared handle to the (client-only) engine instance; null until mounted. */
export type OfficeRef = RefObject<Office | null>;

// Optional RPG fields the engine may add; widened locally so this compiles before and after.
export type RpgRow = RosterRow & { level?: number; xp?: number; xpNext?: number; gold?: number; kills?: number; hp?: number; hpMax?: number };
