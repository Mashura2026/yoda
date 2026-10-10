"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { assignments, enrollments, holidays, programTasks, roles, settings, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { academyDay } from "@/lib/dates";
import { enroll } from "@/lib/enroll";
import { requireAdmin } from "@/lib/session";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function updateSetting(f: FormData) {
  const actor = await requireAdmin();
  const db = getDb();
  const key = str(f, "key");
  const raw = str(f, "value");
  let value: unknown = null;
  if (raw !== "") {
    try { value = JSON.parse(raw); } catch { value = raw; }
  }
  const [before] = await db.select().from(settings).where(eq(settings.key, key));
  if (!before) throw new Error("Unknown setting");
  await db.update(settings).set({ value, pendingOwner: value === null ? before.pendingOwner : null }).where(eq(settings.key, key));
  await audit(db, { actorId: actor.id, action: "update_setting", entity: "setting", entityId: key, before: before.value, after: value });
  revalidatePath("/admin/settings");
}

export async function addHoliday(f: FormData) {
  const actor = await requireAdmin();
  const date = str(f, "date");
  const name = str(f, "name");
  if (!isDate(date) || !name) throw new Error("Date and name are required");
  const db = getDb();
  await db.insert(holidays).values({ date, name }).onConflictDoNothing();
  await audit(db, { actorId: actor.id, action: "add_holiday", entity: "holiday", entityId: date, after: { date, name } });
  revalidatePath("/admin/holidays");
}

export async function removeHoliday(f: FormData) {
  const actor = await requireAdmin();
  const date = str(f, "date");
  const db = getDb();
  await db.delete(holidays).where(eq(holidays.date, date));
  await audit(db, { actorId: actor.id, action: "remove_holiday", entity: "holiday", entityId: date });
  revalidatePath("/admin/holidays");
}

export async function addPerson(f: FormData) {
  const actor = await requireAdmin();
  const db = getDb();
  const email = str(f, "email").toLowerCase();
  const name = str(f, "name");
  if (!email || !name) throw new Error("Name and email are required");
  const [u] = await db
    .insert(users)
    .values({ email, name, timezone: str(f, "timezone") || "America/Chicago", slackUserId: str(f, "slack") || null })
    .onConflictDoUpdate({ target: users.email, set: { name } })
    .returning();
  for (const role of f.getAll("role").map(String)) {
    const track = str(f, "track") || null;
    await db.insert(roles).values({ userId: u.id, role, track: track as "RSD" | "SDR" | null }).onConflictDoNothing();
  }
  await audit(db, { actorId: actor.id, action: "add_person", entity: "user", entityId: u.id, after: { email, name } });
  revalidatePath("/admin/people");
}

export async function createEnrollment(f: FormData) {
  const actor = await requireAdmin();
  const day1 = str(f, "day1");
  if (!isDate(day1)) throw new Error("Day 1 must be a date");
  const track = str(f, "track") as "RSD" | "SDR";
  const partnerStart = str(f, "partnerStart");
  await enroll(getDb(), {
    traineeId: Number(f.get("traineeId")),
    track,
    day1,
    managerId: f.get("managerId") ? Number(f.get("managerId")) : null,
    podPartnerId: f.get("podPartnerId") ? Number(f.get("podPartnerId")) : null,
    partnerStart: isDate(partnerStart) ? partnerStart : null,
    provisional: f.get("provisional") === "on",
    actorId: actor.id,
  });
  revalidatePath("/admin/enrollments");
}

/** Edits a template task. Active enrollments change only when the admin ticks "apply". */
export async function updateTask(f: FormData) {
  const actor = await requireAdmin();
  const db = getDb();
  const id = Number(f.get("id"));
  const title = str(f, "title");
  const dueDay = f.get("dueDay") ? Number(f.get("dueDay")) : null;
  const [before] = await db.select().from(programTasks).where(eq(programTasks.id, id));
  if (!before) throw new Error("Unknown task");
  await db.update(programTasks).set({ title, dueDay, pendingOwner: null }).where(eq(programTasks.id, id));
  await audit(db, { actorId: actor.id, action: "update_task", entity: "program_task", entityId: id, before, after: { title, dueDay } });

  if (f.get("apply") === "on" && dueDay != null && before.dueAnchor === "day1") {
    const active = await db.select().from(enrollments).where(eq(enrollments.status, "active"));
    const ids = active.map((e) => e.id);
    if (ids.length) {
      const rows = await db
        .select()
        .from(assignments)
        .where(and(eq(assignments.taskId, id), inArray(assignments.enrollmentId, ids), eq(assignments.state, "pending")));
      for (const a of rows) {
        const e = active.find((x) => x.id === a.enrollmentId)!;
        const next = academyDay(e.day1, dueDay);
        await db.update(assignments).set({ activeDue: next, title }).where(eq(assignments.id, a.id));
        await audit(db, { actorId: actor.id, action: "apply_template_change", entity: "assignment", entityId: a.id, before: a.activeDue, after: next });
      }
    }
  }
  revalidatePath("/admin/programs");
}
