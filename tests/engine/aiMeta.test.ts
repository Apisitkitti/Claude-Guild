import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AttentionMsgRow } from "@/lib/office/engine";

import { emp, ev, newOffice, seat, sid, stubStorage, tick } from "./helpers";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  stubStorage();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const LIMIT = { since: Date.parse("2026-01-01T11:59:00Z"), resetText: "3pm (UTC)", resetsAt: null };

describe("AI badge on the roster", () => {
  it("defaults to Claude with no model", () => {
    const office = newOffice();
    const session = sid();
    seat(office, session);
    const row = office.getView().roster[0];
    expect(row.ai).toMatchObject({ source: "claude", model: null, label: "Claude", short: "CLAUDE" });
    expect(row.rateLimit).toBeNull();
  });

  it("reads source, model and rateLimit from a snapshot", () => {
    const office = newOffice();
    const session = sid();
    office.loadSnapshot({
      sessions: [
        { session_id: session, cwd: "/work/proj", source: "claude", model: "claude-opus-5-5", rateLimit: LIMIT },
      ],
      events: [],
    });
    const row = office.getView().roster[0];
    expect(row.ai.label).toBe("Opus 5.5");
    expect(row.ai.short).toBe("OPUS 5.5");
    expect(row.rateLimit).toEqual(LIMIT);
  });

  it("session_meta updates the badge and clears the limit", () => {
    const office = newOffice();
    const session = sid();
    seat(office, session);
    office.setSessionMeta(session, { source: "codex", model: "gpt-5-codex", rateLimit: LIMIT });
    let row = office.getView().roster[0];
    expect(row.ai.label).toBe("Codex · gpt-5-codex");
    expect(row.rateLimit?.resetText).toBe("3pm (UTC)");
    expect(row.status).toMatch(/\S/);
    office.setSessionMeta(session, { source: "codex", model: "gpt-5-codex", rateLimit: null });
    row = office.getView().roster[0];
    expect(row.rateLimit).toBeNull();
  });

  it("ignores unknown sessions, bad sources and a missing rateLimit key", () => {
    const office = newOffice();
    const session = sid();
    seat(office, session);
    office.setSessionMeta("nobody", { source: "codex" });
    office.setSessionMeta(session, { source: "nope", model: 7 });
    expect(office.getView().roster[0].ai.source).toBe("claude");
    office.setSessionMeta(session, { rateLimit: LIMIT });
    office.setSessionMeta(session, { model: "claude-haiku-5-5" });
    expect(office.getView().roster[0].rateLimit).not.toBeNull();
    expect(office.getView().roster[0].ai.label).toBe("Haiku 5.5");
  });
});

describe("StopFailure", () => {
  it("ends the turn like Stop (back to thinking, pending cleared) without a tavern trip", () => {
    const office = newOffice();
    const session = sid();
    const adventurer = seat(office, session);
    office.event(ev(session, "UserPromptSubmit"));
    office.event(ev(session, "PreToolUse", { tool_name: "Read", tool_use_id: "t1" }));
    tick(office, 0.5);
    expect(adventurer.pending.size).toBeGreaterThan(0);
    office.event(ev(session, "StopFailure", { error: "server_error" }));
    tick(office, 0.5);
    expect(adventurer.pending.size).toBe(0);
    expect(adventurer.act).toBe("thinking");
    expect(adventurer.state).toBe("SEATED");
  });

  it("a rate_limit StopFailure keeps the adventurer at the desk", () => {
    const office = newOffice();
    const session = sid();
    seat(office, session);
    office.event(ev(session, "UserPromptSubmit"));
    office.event(ev(session, "StopFailure", { error: "rate_limit" }));
    tick(office, 0.5);
    expect(emp(office, session).state).toBe("SEATED");
  });

  it("a limited adventurer is pulled off a tavern trip and stays seated", () => {
    const office = newOffice();
    const session = sid();
    seat(office, session);
    office.event(ev(session, "Stop"));
    tick(office, 0.5);
    expect(emp(office, session).state).not.toBe("SEATED");
    office.setSessionMeta(session, { rateLimit: LIMIT });
    tick(office, 30);
    expect(emp(office, session).state).toBe("SEATED");
    expect(emp(office, session).rateLimit).not.toBeNull();
  });

  it("queues a limit sound only for a live session_meta, not for a snapshot", () => {
    const office = newOffice();
    const session = sid();
    office.loadSnapshot({ sessions: [{ session_id: session, cwd: "/work/proj", rateLimit: LIMIT }], events: [] });
    expect(office.sfxQueue).not.toContain("limit");
    const other = sid();
    seat(office, other);
    office.sfxQueue.length = 0;
    office.setSessionMeta(other, { rateLimit: LIMIT });
    expect(office.sfxQueue).toContain("limit");
  });
});

describe("session_meta before the session exists", () => {
  it("is kept and applied when the adventurer spawns", () => {
    const office = newOffice();
    const session = sid();
    office.setSessionMeta(session, { source: "cursor", model: "auto", rateLimit: LIMIT });
    seat(office, session);
    const row = office.getView().roster[0];
    expect(row.ai.source).toBe("cursor");
    expect(row.rateLimit).not.toBeNull();
  });
});

describe("limit in the guild master report and attention queue", () => {
  it("lists a limited session below permission and question, with the reset text", () => {
    const office = newOffice();
    const limited = sid("l");
    const asking = sid("q");
    seat(office, limited);
    seat(office, asking);
    office.setSessionMeta(limited, { rateLimit: LIMIT });
    office.event(ev(asking, "PermissionRequest", { tool_name: "Bash" }));
    tick(office, 1);
    const rows = office.guildMasterReport();
    const reasons = rows.map((row) => row.reason);
    expect(reasons).toContain("limit");
    expect(reasons.indexOf("permission")).toBeLessThan(reasons.indexOf("limit"));
    expect(rows.find((row) => row.reason === "limit")?.detail).toBe("3pm (UTC)");
  });

  it("accepts a limit queue row and keeps its detail", () => {
    const office = newOffice();
    const session = sid();
    seat(office, session);
    const row: AttentionMsgRow = {
      key: `${session}|limit`,
      sid: session,
      kind: "limit",
      since: Date.now(),
      detail: "3pm (UTC)",
    };
    office.setAttention([row]);
    const rows = office.getView().attention ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "limit", detail: "3pm (UTC)" });
  });
});
