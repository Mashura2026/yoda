import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { assignments } from "../src/db/schema";
import { enroll } from "../src/lib/enroll";
import { traineeView } from "../src/lib/trainee";
import { testDb } from "./helpers";

type Ctx = Awaited<ReturnType<typeof testDb>>;
let c: Ctx;
// Noon UTC on Nov 5, 2026 is the same calendar date in America/Chicago.
const now = new Date("2026-11-05T18:00:00Z");

beforeAll(async () => {
  c = await testDb();
  await enroll(c.db, { traineeId: c.louis.id, track: "RSD", day1: "2026-10-19", actorId: null });
  await enroll(c.db, { traineeId: c.colin.id, track: "SDR", day1: "2026-10-19", actorId: null });
});

describe("trainee dashboard", () => {
  it("computes day number and next gate", async () => {
    const v = (await traineeView(c.db, c.louis.id, now))!;
    expect(v.day).toBe(18);
    expect(v.gate).toMatchObject({ day: 30, target: "2026-11-17", daysLeft: 12 });
  });
  it("buckets overdue work and keeps dependencies out of overdue", async () => {
    const v = (await traineeView(c.db, c.louis.id, now))!;
    expect(v.overdue.map((t) => t.title)).toContain("Product line");
    const all = [...v.overdue, ...v.dueToday, ...v.thisWeek, ...v.later];
    expect(all.find((t) => t.title.startsWith("Module D"))).toBeUndefined();
    expect(v.waiting.map((t) => t.title).some((t) => t.startsWith("Module D"))).toBe(true);
  });
  it("hides admin-only placeholders from trainees", async () => {
    const v = (await traineeView(c.db, c.colin.id, now))!;
    const titles = [...v.overdue, ...v.dueToday, ...v.thisWeek, ...v.later, ...v.waiting, ...v.done].map((t) => t.title);
    expect(titles).not.toContain("SDR weeks 4 to 13");
  });
  it("only counts verified field activities", async () => {
    const v = (await traineeView(c.db, c.louis.id, now))!;
    expect(v.field.every((t) => t.verified === 0)).toBe(true);
  });
  it("never exposes another trainee's assignments", async () => {
    const l = (await traineeView(c.db, c.louis.id, now))!;
    const rows = await c.db.select().from(assignments).where(eq(assignments.enrollmentId, l.enrollmentId));
    const colin = (await traineeView(c.db, c.colin.id, now))!;
    expect(colin.enrollmentId).not.toBe(l.enrollmentId);
    expect(rows.length).toBeGreaterThan(0);
  });
});
