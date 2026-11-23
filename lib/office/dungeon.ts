/** Client-side counters behind the dungeon-gate card. Everything counts since the page opened (or since the last Live/Demo switch). */
export interface DungeonStats {
  /** Date.now() when counting began */
  since: number;
  /** sessions that entered the guild / left it */
  entered: number;
  left: number;
  /** adventurers in the guild right now (not leaving) */
  live: number;
  monsters: number;
  /** bosses defeated, bosses on the field right now, longest fight (sim seconds) */
  bosses: number;
  bossesAlive: number;
  longestBossS: number;
  /** total sim seconds adventurers spent with a hand up (permission prompts), finished waits + ongoing ones */
  waitS: number;
  /** adventurers raiding inside the dungeon right now */
  raiders: number;
  /** the raiders the session filter lets through (what the dungeon scene and the gate badge actually show) */
  raidersShown: number;
  /** raiders per dungeon floor (index 0 = B1) among the ones the filter lets through */
  floorRaiders: number[];
  /** the Dungeon Lord on B3: still standing, how much hp is left (0..1), times slain */
  lordAlive: boolean;
  lordHp: number;
  lordSlain: number;
  /** raiders are fighting a live Dungeon Lord on B3 (or it just fell): the guild scene shows the live inset */
  lordFight: boolean;
  topTools: { tool: string; count: number }[];
}

const TOOL_NAME_MAX = 60;
const TOOL_KINDS_MAX = 80;
export const TOP_TOOLS = 3;

/** counts tool names (capped so a long session of odd MCP names cannot grow it without bound) */
export class ToolTally {
  private counts = new Map<string, number>();
  add(tool: string) {
    const name = tool.slice(0, TOOL_NAME_MAX);
    if (!name) return;
    const known = this.counts.get(name);
    if (known === undefined && this.counts.size >= TOOL_KINDS_MAX) return;
    this.counts.set(name, (known ?? 0) + 1);
  }
  top(limit = TOP_TOOLS): { tool: string; count: number }[] {
    return [...this.counts.entries()]
      .sort((first, second) => second[1] - first[1] || (first[0] < second[0] ? -1 : 1))
      .slice(0, limit)
      .map(([tool, count]) => ({ tool, count }));
  }
  clear() {
    this.counts.clear();
  }
}
