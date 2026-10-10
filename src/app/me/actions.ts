"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { assignments, enrollments, evidence, programTasks } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireUserId } from "@/lib/session";

/**
 * Trainee submits evidence or marks work done. The assignment must belong to the
 * signed-in trainee's own enrollment. Host-verified work becomes "attended" only;
 * it counts once a host confirms.
 */
export async function submitEvidence(f: FormData) {
  const userId = await requireUserId();
  const db = getDb();
  const assignmentId = Number(f.get("assignmentId"));
  const link = String(f.get("link") ?? "").trim() || null;
  const debrief = String(f.get("debrief") ?? "").trim() || null;

  const [row] = await db
    .select({ a: assignments, t: programTasks, e: enrollments })
    .from(assignments)
    .innerJoin(programTasks, eq(assignments.taskId, programTasks.id))
    .innerJoin(enrollments, eq(assignments.enrollmentId, enrollments.id))
    .where(and(eq(assignments.id, assignmentId), eq(enrollments.traineeId, userId)));
  if (!row) {
    await audit(db, { actorId: userId, action: "access_denied", entity: "assignment", entityId: assignmentId });
    throw new Error("Not found");
  }
  if (row.t.requiresHostVerification && !debrief) throw new Error("A short debrief is required");
  if (row.t.evidenceRequired && !link && !debrief) throw new Error("Add a link or a note as evidence");

  await db.insert(evidence).values({ assignmentId, type: row.t.requiresHostVerification ? "field_debrief" : "proof", link, debrief });
  const next = row.t.requiresHostVerification ? "attended" : "done";
  await db.update(assignments).set({ state: next, completedAt: new Date() }).where(eq(assignments.id, assignmentId));
  await audit(db, { actorId: userId, action: "submit_evidence", entity: "assignment", entityId: assignmentId, before: row.a.state, after: next });
  revalidatePath("/me");
}

export async function markDone(f: FormData) {
  const userId = await requireUserId();
  const db = getDb();
  const assignmentId = Number(f.get("assignmentId"));
  const [row] = await db
    .select({ a: assignments, t: programTasks })
    .from(assignments)
    .innerJoin(programTasks, eq(assignments.taskId, programTasks.id))
    .innerJoin(enrollments, eq(assignments.enrollmentId, enrollments.id))
    .where(and(eq(assignments.id, assignmentId), eq(enrollments.traineeId, userId)));
  if (!row) {
    await audit(db, { actorId: userId, action: "access_denied", entity: "assignment", entityId: assignmentId });
    throw new Error("Not found");
  }
  if (row.t.evidenceRequired || row.t.requiresHostVerification) throw new Error("This task needs evidence");
  await db.update(assignments).set({ state: "done", completedAt: new Date() }).where(eq(assignments.id, assignmentId));
  await audit(db, { actorId: userId, action: "mark_done", entity: "assignment", entityId: assignmentId, before: row.a.state, after: "done" });
  revalidatePath("/me");
}
