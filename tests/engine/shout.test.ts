import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emp, ev, newOffice, seat, sid, stubStorage, tick } from "./helpers";

beforeEach(() => { vi.useFakeTimers(); stubStorage(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("guild shout", () => {
  it("shows a speech bubble for ~5s and a quest log line, and never raises a hand", () => {
    const o = newOffice(); const id = "mcp-alice";
    seat(o, id);
    o.event(ev(id, "Notification", { notification_type: "guild_shout", message: "need permission to touch auth" }));
    tick(o, 0.2);
    const e = emp(o, id);
    expect(e.speech?.text).toBe("need permission to touch auth");
    expect(e.act).not.toBe("handup");
    const row = o.getView().log[0];
    expect(row.text).toBe("📣 alice: need permission to touch auth");
    expect(row.kind).toBe("Shout");
    expect(row.detail).toBe("need permission to touch auth");
    tick(o, 5.5);
    expect(o.realTime).toBeGreaterThan(e.speech!.until);
  });

  it("other sessions' permission notifications still raise a hand", () => {
    const o = newOffice(); const id = sid();
    seat(o, id);
    o.event(ev(id, "Notification", { notification_type: "permission_prompt", message: "x" }));
    tick(o, 0.2);
    expect(emp(o, id).act).toBe("handup");
  });
});
