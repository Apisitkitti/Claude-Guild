import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Sfx } from "@/lib/office/audio";

import { ev, fixedRandom, newOffice, seat, sid, stubStorage, tick } from "./engine/helpers";

const makeNode = () => {
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  return {
    type: "",
    buffer: null,
    gain: param(),
    frequency: param(),
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    getChannelData: () => new Float32Array(8),
  };
};

const makeCtx = () => ({
  currentTime: 0,
  sampleRate: 8000,
  destination: {},
  resume: vi.fn(),
  close: vi.fn(),
  createOscillator: vi.fn(makeNode),
  createGain: vi.fn(makeNode),
  createBuffer: vi.fn(makeNode),
  createBufferSource: vi.fn(makeNode),
});

describe("Sfx", () => {
  it("creates no AudioContext until started, and plays nothing", () => {
    const factory = vi.fn(makeCtx);
    const sfx = new Sfx(factory);
    expect(sfx.play("bell")).toBe(false);
    sfx.tick();
    expect(factory).not.toHaveBeenCalled();
    expect(sfx.started).toBe(false);
  });

  it("a cue schedules oscillators", () => {
    const ctx = makeCtx();
    const sfx = new Sfx(() => ctx);
    expect(sfx.start()).toBe(true);
    expect(sfx.play("levelUp")).toBe(true);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(5);
    expect(sfx.play("bell")).toBe(true);
    expect(ctx.createOscillator.mock.calls.length).toBeGreaterThan(5);
  });

  it("rate-limits hits to 6 per second", () => {
    const ctx = makeCtx();
    const sfx = new Sfx(() => ctx);
    sfx.start();
    const played = Array.from({ length: 20 }, () => sfx.play("hit")).filter(Boolean).length;
    expect(played).toBe(6);
    ctx.currentTime = 1.1;
    expect(sfx.play("hit")).toBe(true);
  });

  it("ambient schedules notes ahead, and stop closes the context", () => {
    const ctx = makeCtx();
    const sfx = new Sfx(() => ctx);
    sfx.start();
    sfx.setAmbient("tavern");
    sfx.tick();
    expect(ctx.createOscillator).toHaveBeenCalled();
    const before = ctx.createOscillator.mock.calls.length;
    sfx.setAmbient(null);
    sfx.tick();
    expect(ctx.createOscillator.mock.calls.length).toBe(before);
    sfx.stop();
    expect(ctx.close).toHaveBeenCalled();
    expect(sfx.play("bell")).toBe(false);
  });

  it("dungeon ambient is a drone", () => {
    const ctx = makeCtx();
    const sfx = new Sfx(() => ctx);
    sfx.start();
    sfx.setAmbient("dungeon");
    sfx.tick();
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
  });
});

describe("engine sound cues", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    stubStorage();
    fixedRandom(0.5);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("hit, level-up and boss events push cues", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.sfxQueue.length = 0;
    employee.xp = 9;
    employee.monHp = employee.monHpMax = 99;
    office.event(ev(id, "PostToolUse", { tool_name: "Read" }));
    expect(office.sfxQueue).toContain("hit");
    expect(office.sfxQueue).toContain("levelUp");
    office.sfxQueue.length = 0;
    office.event(ev(id, "PreToolUse", { tool_name: "Bash", tool_use_id: "t1" }));
    tick(office, 31);
    expect(office.sfxQueue).toContain("bossAppear");
    office.event(ev(id, "PostToolUse", { tool_name: "Bash", tool_use_id: "t1" }));
    expect(office.sfxQueue).toContain("bossDown");
  });

  it("a kill pushes a kill cue", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.sfxQueue.length = 0;
    employee.monHp = 1;
    office.event(ev(id, "PostToolUse", { tool_name: "Read" }));
    expect(office.sfxQueue).toContain("kill");
  });

  it("a new bell row rings once; the first snapshot is only a baseline", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.sfxQueue.length = 0;
    office.setAttention([]);
    expect(office.sfxQueue).not.toContain("bell");
    const rows = [{ key: "k1", sid: id, kind: "permission" as const, since: 1 }];
    office.setAttention(rows);
    expect(office.sfxQueue.filter((cue) => cue === "bell")).toHaveLength(1);
    office.setAttention(rows);
    expect(office.sfxQueue.filter((cue) => cue === "bell")).toHaveLength(1);
  });

  it("the queue is capped", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    employee.monHp = employee.monHpMax = 9999;
    for (let count = 0; count < 100; count++) office.event(ev(id, "PostToolUse", { tool_name: "Read" }));
    expect(office.sfxQueue.length).toBeLessThanOrEqual(32);
  });
});
