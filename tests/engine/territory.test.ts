import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { conflictKey, KIND_CLASH, type TerritoryMsg } from "@/lib/office/engine";

import { newOffice, seat, sid, stubStorage, tick } from "./helpers";

beforeEach(() => {
  vi.useFakeTimers();
  stubStorage();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const msg = (sessionA: string, sessionB: string, level: "overlap" | "clash" = "overlap"): TerritoryMsg => ({
  claims: [
    { sid: sessionA, files: ["src/a.ts", "src/b.ts"] },
    { sid: sessionB, files: ["src/a.ts"] },
  ],
  conflicts: [{ file: "src/a.ts", sids: [sessionA, sessionB], level, since: 1 }],
});

const two = () => {
  const office = newOffice();
  const sessionA = sid(),
    sessionB = sid();
  seat(office, sessionA, { cwd: "/w/alpha" });
  seat(office, sessionB, { cwd: "/w/beta" });
  return { o: office, a: sessionA, b: sessionB };
};

describe("territory", () => {
  it("roster shows claims and conflict level", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b));
    const rows = o.getView().roster;
    const ra = rows.find((row) => row.id === a)!,
      rb = rows.find((row) => row.id === b)!;
    expect([ra.claims, rb.claims]).toEqual([2, 1]);
    expect([ra.conflict, rb.conflict]).toEqual(["overlap", "overlap"]);
    o.setTerritory(msg(a, b, "clash"));
    expect(o.getView().roster.every((row) => row.conflict === "clash")).toBe(true);
    o.setTerritory({ claims: [], conflicts: [] });
    const r0 = o.getView().roster[0];
    expect(r0.claims).toBeUndefined();
    expect(r0.conflict).toBeUndefined();
  });

  it("conflicts list has names, level, file", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b));
    const conflicts = o.getView().conflicts!;
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].file).toBe("src/a.ts");
    expect(conflicts[0].level).toBe("overlap");
    expect(conflicts[0].sids).toEqual([a, b]);
    expect(conflicts[0].names[0]).toContain("alpha");
    expect(conflicts[0].names[1]).toContain("beta");
  });

  it("dismiss hides; escalation to clash re-shows; clashCount counts only clashes", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b));
    expect(o.clashCount()).toBe(0);
    const key = o.getView().conflicts![0].key;
    expect(key).toBe(conflictKey({ file: "src/a.ts", level: "overlap" }));
    o.dismissConflict(key);
    expect(o.getView().conflicts).toHaveLength(0);
    expect(o.getView().roster.every((row) => row.conflict === undefined)).toBe(true);
    o.setTerritory(msg(a, b)); // same state again stays dismissed
    expect(o.getView().conflicts).toHaveLength(0);
    o.setTerritory(msg(a, b, "clash"));
    expect(o.getView().conflicts).toHaveLength(1);
    expect(o.clashCount()).toBe(1);
    o.dismissConflict(o.getView().conflicts![0].key);
    expect(o.clashCount()).toBe(0);
  });

  it("dismissal survives a brief absence and is forgotten after the TTL", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b));
    o.dismissConflict(o.getView().conflicts![0].key);
    o.setTerritory({ claims: [], conflicts: [] });
    o.setTerritory(msg(a, b)); // flapped back quickly: still dismissed
    expect(o.getView().conflicts).toHaveLength(0);
    o.setTerritory({ claims: [], conflicts: [] });
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    o.setTerritory({ claims: [], conflicts: [] }); // expiry sweep
    o.setTerritory(msg(a, b));
    expect(o.getView().conflicts).toHaveLength(1);
  });

  it("a third session joining a clash does not re-alert nor undo a dismissal", () => {
    const { o, a, b } = two();
    const sessionC = sid();
    seat(o, sessionC, { cwd: "/w/gamma" });
    o.banners.length = 0;
    o.setTerritory(msg(a, b, "clash"));
    expect(o.banners).toHaveLength(1);
    const logN = o.getView().log.length;
    const three: TerritoryMsg = {
      claims: [],
      conflicts: [{ file: "src/a.ts", sids: [a, b, sessionC], level: "clash", since: 1 }],
    };
    o.setTerritory(three);
    expect(o.banners).toHaveLength(1);
    expect(o.getView().log.length).toBe(logN);
    o.dismissConflict(o.getView().conflicts![0].key);
    o.setTerritory(msg(a, b, "clash")); // membership changes again
    expect(o.getView().conflicts).toHaveLength(0);
    expect(o.clashCount()).toBe(0);
  });

  it("clash alert deferred for an unknown session fires once it joins", () => {
    const office = newOffice();
    const sessionA = sid(),
      sessionB = sid();
    seat(office, sessionA, { cwd: "/w/alpha" });
    office.banners.length = 0;
    office.setTerritory(msg(sessionA, sessionB, "clash"));
    expect(office.banners).toHaveLength(0);
    seat(office, sessionB, { cwd: "/w/beta" });
    expect(office.banners).toHaveLength(1);
    office.setTerritory(msg(sessionA, sessionB, "clash"));
    expect(office.banners).toHaveLength(1);
  });

  it("clashCount (tab title) still counts a clash when the filter hides both parties", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "clash"));
    o.setFilter({ query: "zzz-no-match" });
    expect(o.getView().roster).toHaveLength(0);
    expect(o.clashCount()).toBe(1);
    o.setFilter({ query: "beta" });
    expect(o.getView().roster.map((row) => row.id)).toEqual([b]);
    expect(o.clashCount()).toBe(1);
  });

  it("new clash raises banner, trauma and a log row once", () => {
    const { o, a, b } = two();
    o.banners.length = 0;
    o.trauma = 0;
    const logN = o.getView().log.length;
    o.setTerritory(msg(a, b, "clash"));
    expect(o.banners.at(-1)?.text).toContain("src/a.ts");
    expect(o.trauma).toBeGreaterThan(0);
    const log = o.getView().log;
    expect(log.length).toBe(logN + 1);
    expect(log[0].kind).toBe(KIND_CLASH);
    o.setTerritory(msg(a, b, "clash"));
    expect(o.getView().log.length).toBe(logN + 1);
  });

  it("no shake under reduced motion; overlap never alerts", () => {
    const { o, a, b } = two();
    o.reducedMotion = true;
    o.trauma = 0;
    o.setTerritory(msg(a, b, "clash"));
    expect(o.trauma).toBe(0);
    const pair = two();
    pair.o.banners.length = 0;
    pair.o.setTerritory(msg(pair.a, pair.b));
    expect(pair.o.banners).toHaveLength(0);
    void a;
    void b;
  });

  it("unknown sessions are ignored gracefully", () => {
    const { o, a } = two();
    o.setTerritory(msg(a, "ghost-session", "clash"));
    expect(o.getView().conflicts).toHaveLength(0);
    expect(o.clashCount()).toBe(0);
    expect(o.getView().roster.find((row) => row.id === a)!.conflict).toBeUndefined();
    o.setTerritory({ claims: [{ sid: "ghost", files: ["x"] }], conflicts: [] }); // no throw
  });

  it("garbage input does not throw", () => {
    const { o } = two();
    expect(() => o.setTerritory(null)).not.toThrow();
    expect(() =>
      o.setTerritory({
        claims: "x",
        conflicts: [{ file: 1 }, null, { file: "f", sids: ["a"], level: "clash", since: 0 }],
      } as unknown as TerritoryMsg),
    ).not.toThrow();
    expect(o.getView().conflicts).toHaveLength(0);
  });

  it("snapshot territory applies quietly (no banner for existing clashes)", () => {
    const office = newOffice();
    const sessionA = sid(),
      sessionB = sid();
    office.loadSnapshot({
      sessions: [
        { session_id: sessionA, cwd: "/w/alpha" },
        { session_id: sessionB, cwd: "/w/beta" },
      ],
      territory: msg(sessionA, sessionB, "clash"),
    });
    expect(office.getView().conflicts).toHaveLength(1);
    expect(office.clashCount()).toBe(1);
    expect(office.banners).toHaveLength(0);
    office.setTerritory(msg(sessionA, sessionB, "clash")); // same key afterwards: still no alert
    expect(office.banners).toHaveLength(0);
  });

  it("snapshot without territory keeps current state", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b));
    o.loadSnapshot({ sessions: [{ session_id: a }, { session_id: b }] });
    expect(o.getView().conflicts).toHaveLength(1);
  });

  it("filter hides roster rows but the conflict stays listed and counted", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "clash"));
    o.setFilter({ query: "alpha" });
    const view = o.getView();
    expect(view.roster.map((row) => row.id)).toEqual([a]);
    expect(view.conflicts).toHaveLength(1);
    expect(o.clashCount()).toBe(1);
  });

  it("view re-emits when territory changes", () => {
    const { o, a, b } = two();
    const cb = vi.fn();
    o.subscribe(cb);
    cb.mockClear();
    o.setTerritory(msg(a, b));
    o.publish();
    expect(cb).toHaveBeenCalledTimes(1);
    o.publish();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("clear() drops territory; drawing with conflicts does not throw", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "clash"));
    expect(() => tick(o, 1)).not.toThrow();
    o.clear();
    expect(o.getView().conflicts).toEqual([]);
  });
});
