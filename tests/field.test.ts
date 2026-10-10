import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { assignments, enrollments, evidence, roles, users } from "../src/db/schema";
import { loadActor } from "../src/lib/authz";
import { enroll } from "../src/lib/enroll";
import { addDebrief, flagNoSlot, listVerifiable, scheduleActivity, schedulingBoard, verifyEvidence } from "../src/lib/field";
import { traineeView } from "../src/lib/trainee";
import { testDb } from "./helpers";

type Ctx = Awaited<ReturnType<typeof testDb>>;
let c: Ctx;
let phoebe: number, pod: number, stranger: number, enrollmentId: number, callAssignment: number;
const now = new Date("2026-11-05T18:00:00Z");

async function person(email: string, role: string) {
  const [u] = await c.db.insert(users).values({ email, name: email.split("@")[0] }).returning();
  await c.db.insert(roles).values({ userId: u.id, role });
  return u.id;
}

beforeAll(async () => {
  c = await testDb();
  phoebe = await person("phoebe@example.test", "scheduler");
  pod = await person("pod@example.test", "pod_partner");
  stranger = await person("stranger@example.test", "pod_partner");
  const e = await enroll(c.db, { traineeId: c.colin.id, track: "SDR", day1: "2026-10-19", podPartnerId: pod, actorId: null });
  enrollmentId = e.id;
  const rows = await c.db.select().from(assignments).where(eq(assignments.enrollmentId, e.id));
  callAssignment = rows.find((r) => r.title.startsWith("Observe sales calls"))!.id;
});

describe("acceptance 7: field activity counts only when host-verified with a debrief", () => {
  let evId: number;
  it("only a scheduler can book", async () => {
    await expect(scheduleActivity(c.db, await loadActor(c.db, c.colin.id), { assignmentId: callAssignment, hostId: pod, date: "2026-11-10" })).rejects.toThrow();
    await scheduleActivity(c.db, await loadActor(c.db, phoebe), { assignmentId: callAssignment, hostId: pod, date: "2026-11-10" });
    evId = (await c.db.select().from(evidence).where(eq(evidence.assignmentId, callAssignment)))[0].id;
  });
  it("is not counted while only scheduled or self-reported", async () => {
    const v = (await traineeView(c.db, c.colin.id, now))!;
    expect(v.field.find((t) => t.title.startsWith("Observe"))!.verified).toBe(0);
  });
  it("cannot be verified without the trainee debrief", async () => {
    await expect(verifyEvidence(c.db, await loadActor(c.db, pod), evId)).rejects.toThrow(/debrief/);
  });
  it("a trainee cannot verify, an unrelated partner cannot see it", async () => {
    await addDebrief(c.db, c.colin.id, evId, "Watched the discovery call and the objection handling.");
    await expect(verifyEvidence(c.db, await loadActor(c.db, c.colin.id), evId)).rejects.toThrow();
    expect(await listVerifiable(c.db, await loadActor(c.db, stranger))).toHaveLength(0);
    expect(await listVerifiable(c.db, await loadActor(c.db, pod))).toHaveLength(1);
  });
  it("another trainee cannot add a debrief to this activity", async () => {
    await expect(addDebrief(c.db, c.louis.id, evId, "x")).rejects.toThrow();
  });
  it("counts once the host confirms", async () => {
    await verifyEvidence(c.db, await loadActor(c.db, pod), evId);
    const v = (await traineeView(c.db, c.colin.id, now))!;
    expect(v.field.find((t) => t.title.startsWith("Observe"))!.verified).toBe(1);
  });
});

describe("scheduling board and dependencies", () => {
  it("shows what is still needed and hides from non-schedulers", async () => {
    const board = await schedulingBoard(c.db, await loadActor(c.db, phoebe));
    const row = board.find((b) => b.activity.startsWith("Observe"))!;
    expect(row).toMatchObject({ required: 2, verified: 1, needed: 1 });
    await expect(schedulingBoard(c.db, await loadActor(c.db, c.colin.id))).rejects.toThrow();
  });
  it("no slot is a company dependency, not a trainee miss", async () => {
    const rows = await c.db.select().from(assignments).where(eq(assignments.enrollmentId, enrollmentId));
    const install = rows.find((r) => r.title.startsWith("Attend customer installations"))!;
    await flagNoSlot(c.db, await loadActor(c.db, phoebe), install.id);
    await c.db.update(assignments).set({ activeDue: null }).where(eq(assignments.id, install.id));
    const v = (await traineeView(c.db, c.colin.id, now))!;
    expect(v.waiting.map((t) => t.title)).toContain("Attend customer installations");
    expect(v.overdue.map((t) => t.title)).not.toContain("Attend customer installations");
  });
});

void enrollments;
