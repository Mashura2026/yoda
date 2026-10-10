import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { assignments, auditLog } from "../src/db/schema";
import { enroll } from "../src/lib/enroll";
import { canCertify, canViewEnrollment, loadActor } from "../src/lib/authz";
import { testDb } from "./helpers";

type Ctx = Awaited<ReturnType<typeof testDb>>;
let c: Ctx;
let louisE: { id: number }, colinE: { id: number }, newE: { id: number };

const dues = async (id: number) =>
  Object.fromEntries((await c.db.select().from(assignments).where(eq(assignments.enrollmentId, id))).map((a) => [a.title, a.activeDue]));

beforeAll(async () => {
  c = await testDb();
  louisE = await enroll(c.db, { traineeId: c.louis.id, track: "RSD", day1: "2026-10-19", managerId: c.suzi.id, actorId: c.suzi.id });
  colinE = await enroll(c.db, { traineeId: c.colin.id, track: "SDR", day1: "2026-10-19", managerId: c.mike.id, actorId: c.suzi.id });
});

describe("acceptance 1: independent calendars", () => {
  it("each track gets its own tasks with correct dates", async () => {
    const l = await dues(louisE.id);
    const s = await dues(colinE.id);
    expect(l["Observe sales calls led by a current RSD"]).toBe("2026-11-17");
    expect(l["Attend customer installations"]).toBe("2026-12-17");
    expect(l["Present territory plan to Suzi and Anton"]).toBe("2027-01-16");
    expect(s["Observe sales calls led by a current RSD"]).toBe("2026-11-17");
    expect(l["Module D: SDR partnership working agreement"]).toBeNull();
    expect(s["Module D: SDR partnership working agreement"]).toBeUndefined();
    expect(l["Product line"]).toBe("2026-10-25");
  });
});

describe("acceptance 2: later enrollment leaves others untouched", () => {
  it("November 2 cohort", async () => {
    const before = JSON.stringify([await dues(louisE.id), await dues(colinE.id)]);
    newE = await enroll(c.db, { traineeId: c.newSdr.id, track: "SDR", day1: "2026-11-02", managerId: c.mike.id, provisional: true, actorId: c.suzi.id });
    const n = await dues(newE.id);
    expect(n["Observe sales calls led by a current RSD"]).toBe("2026-12-01");
    expect(n["Attend customer installations"]).toBe("2026-12-31");
    expect(JSON.stringify([await dues(louisE.id), await dues(colinE.id)])).toBe(before);
  });
});

describe("Module D follows partner start", () => {
  it("is dated once a partner exists", async () => {
    const t = await testDb();
    const e = await enroll(t.db, { traineeId: t.louis.id, track: "RSD", day1: "2026-10-19", partnerStart: "2026-11-02", actorId: null });
    const rows = await t.db.select().from(assignments).where(eq(assignments.enrollmentId, e.id));
    expect(rows.find((r) => r.title.startsWith("Module D"))?.activeDue).toBe("2026-12-02");
  });
  it("without a partner it is a dependency, not a due date", async () => {
    const rows = await c.db.select().from(assignments).where(eq(assignments.enrollmentId, louisE.id));
    const d = rows.find((r) => r.title.startsWith("Module D"))!;
    expect(d.dependencyId).not.toBeNull();
    expect(d.activeDue).toBeNull();
  });
});

describe("acceptance 3: privacy", () => {
  it("denies and logs cross-trainee access", async () => {
    const louis = await loadActor(c.db, c.louis.id);
    const colin = await loadActor(c.db, c.colin.id);
    expect(await canViewEnrollment(c.db, louis, colinE.id)).toBe(false);
    expect(await canViewEnrollment(c.db, colin, louisE.id)).toBe(false);
    expect(await canViewEnrollment(c.db, louis, louisE.id)).toBe(true);
    const denied = (await c.db.select().from(auditLog)).filter((r) => r.action === "access_denied");
    expect(denied).toHaveLength(2);
  });
  it("manager and owner scopes", async () => {
    const mike = await loadActor(c.db, c.mike.id);
    const suzi = await loadActor(c.db, c.suzi.id);
    expect(await canViewEnrollment(c.db, mike, colinE.id)).toBe(true);
    expect(await canViewEnrollment(c.db, mike, louisE.id)).toBe(false);
    expect(await canViewEnrollment(c.db, suzi, louisE.id)).toBe(true);
  });
});

describe("acceptance 9 (partial): certifier rights", () => {
  it("Mike certifies SDR only, Suzi both", async () => {
    const mike = await loadActor(c.db, c.mike.id);
    const suzi = await loadActor(c.db, c.suzi.id);
    expect(canCertify(mike, "SDR")).toBe(true);
    expect(canCertify(mike, "RSD")).toBe(false);
    expect(canCertify(suzi, "RSD")).toBe(true);
  });
});

describe("audit log", () => {
  it("records enrollments and is append-only", async () => {
    const rows = await c.db.select().from(auditLog);
    expect(rows.filter((r) => r.action === "enroll").length).toBeGreaterThanOrEqual(3);
    await expect(c.db.delete(auditLog)).rejects.toThrow();
  });
});
