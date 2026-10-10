import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { auditLog } from "../src/db/schema";
import { loadActor } from "../src/lib/authz";
import { enroll } from "../src/lib/enroll";
import { buildPacket, gatesForCertifier, recordDecision } from "../src/lib/gates";
import { testDb } from "./helpers";

type Ctx = Awaited<ReturnType<typeof testDb>>;
let c: Ctx;
let louisE: number, colinE: number;

beforeAll(async () => {
  c = await testDb();
  louisE = (await enroll(c.db, { traineeId: c.louis.id, track: "RSD", day1: "2026-10-19", actorId: null })).id;
  colinE = (await enroll(c.db, { traineeId: c.colin.id, track: "SDR", day1: "2026-10-19", actorId: null })).id;
});

const day30After = new Date("2026-11-18T18:00:00Z");

describe("acceptance 8: a missed gate asks the certifier for a decision", () => {
  it("flags the gate as needing a decision and does not decide", async () => {
    const rows = await gatesForCertifier(c.db, await loadActor(c.db, c.mike.id), day30After);
    expect(rows.find((r) => r.enrollmentId === colinE && r.gateDay === 30)).toMatchObject({ decided: false, overdueDecision: true });
    const suzi = await gatesForCertifier(c.db, await loadActor(c.db, c.suzi.id), day30After);
    expect(suzi.some((r) => r.enrollmentId === louisE)).toBe(true);
  });
  it("Mike sees only SDR gates", async () => {
    const rows = await gatesForCertifier(c.db, await loadActor(c.db, c.mike.id), day30After);
    expect(rows.every((r) => r.track === "SDR")).toBe(true);
  });
});

describe("acceptance 9: only the right certifier decides, one extension max", () => {
  it("Mike cannot decide for an RSD, a trainee cannot decide at all", async () => {
    const input = { enrollmentId: louisE, gateDay: 30, outcome: "certified" as const, rationale: "ok" };
    await expect(recordDecision(c.db, await loadActor(c.db, c.mike.id), input)).rejects.toThrow();
    await expect(recordDecision(c.db, await loadActor(c.db, c.louis.id), input)).rejects.toThrow();
  });
  it("requires a rationale", async () => {
    await expect(recordDecision(c.db, await loadActor(c.db, c.mike.id), { enrollmentId: colinE, gateDay: 30, outcome: "certified", rationale: " " })).rejects.toThrow(/rationale/);
  });
  it("an extension needs a recovery plan, then a second is refused", async () => {
    const mike = await loadActor(c.db, c.mike.id);
    await expect(recordDecision(c.db, mike, { enrollmentId: colinE, gateDay: 30, outcome: "approved_extension", rationale: "Missed installs, no slot" })).rejects.toThrow(/recovery plan/);
    await recordDecision(c.db, mike, { enrollmentId: colinE, gateDay: 30, outcome: "approved_extension", rationale: "Missed installs, no slot", recoveryPlan: "Book two installs by Dec 15." });
    await expect(recordDecision(c.db, mike, { enrollmentId: colinE, gateDay: 60, outcome: "approved_extension", rationale: "Again", recoveryPlan: "Again" })).rejects.toThrow(/One extension/);
  });
  it("one decision per gate", async () => {
    await expect(recordDecision(c.db, await loadActor(c.db, c.mike.id), { enrollmentId: colinE, gateDay: 30, outcome: "certified", rationale: "x" })).rejects.toThrow(/already/);
  });
  it("decisions are audited", async () => {
    const a = (await c.db.select().from(auditLog)).filter((r) => r.action === "gate_decision");
    expect(a.length).toBe(1);
  });
});

describe("packet access", () => {
  it("trainee sees own packet read-only, never another's", async () => {
    const colin = await loadActor(c.db, c.colin.id);
    const own = await buildPacket(c.db, colin, colinE, 30, day30After);
    expect(own.canDecide).toBe(false);
    expect(own.decision?.outcome).toBe("approved_extension");
    expect(own.extendedTo).toBe("2026-12-17");
    await expect(buildPacket(c.db, colin, louisE, 30, day30After)).rejects.toThrow();
    const denied = (await c.db.select().from(auditLog).where(eq(auditLog.action, "access_denied")));
    expect(denied.length).toBeGreaterThan(0);
  });
  it("lists pending placeholders nowhere", async () => {
    const p = await buildPacket(c.db, await loadActor(c.db, c.suzi.id), louisE, 90, day30After);
    expect(p.tasks.map((t) => t.title).join()).not.toContain("Modules A to H");
  });
});
