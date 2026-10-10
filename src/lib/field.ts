import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { assignments, dependencies, enrollments, evidence, programTasks, roles, users } from "@/db/schema";
import type { AnyDb } from "@/db/types";
import { audit } from "./audit";
import type { Actor } from "./authz";

const isRole = (a: Actor, ...r: string[]) => a.roles.some((x) => r.includes(x.role));
export const canSchedule = (a: Actor) => isRole(a, "scheduler", "admin", "program_owner");

export type VerifyItem = {
  evidenceId: number;
  trainee: string;
  activity: string;
  scheduledFor: string | null;
  debrief: string | null;
  link: string | null;
};

/** Field evidence this actor may verify: designated host, the trainee's pod partner, or a scheduler. */
export async function listVerifiable(db: AnyDb, actor: Actor): Promise<VerifyItem[]> {
  const rows = await db
    .select({
      id: evidence.id, hostId: evidence.hostId, podPartnerId: enrollments.podPartnerId,
      trainee: users.name, activity: assignments.title, scheduledFor: evidence.scheduledFor,
      debrief: evidence.debrief, link: evidence.link,
    })
    .from(evidence)
    .innerJoin(assignments, eq(evidence.assignmentId, assignments.id))
    .innerJoin(programTasks, eq(assignments.taskId, programTasks.id))
    .innerJoin(enrollments, eq(assignments.enrollmentId, enrollments.id))
    .innerJoin(users, eq(enrollments.traineeId, users.id))
    .where(and(eq(programTasks.kind, "field_immersion"), isNull(evidence.verifiedAt), ne(evidence.type, "rejected")));
  const all = canSchedule(actor);
  return rows
    .filter((r) => all || r.hostId === actor.id || r.podPartnerId === actor.id)
    .map((r) => ({ evidenceId: r.id, trainee: r.trainee, activity: r.activity, scheduledFor: r.scheduledFor, debrief: r.debrief, link: r.link }));
}

async function loadEvidence(db: AnyDb, evidenceId: number) {
  const [r] = await db
    .select({ ev: evidence, a: assignments, t: programTasks, e: enrollments })
    .from(evidence)
    .innerJoin(assignments, eq(evidence.assignmentId, assignments.id))
    .innerJoin(programTasks, eq(assignments.taskId, programTasks.id))
    .innerJoin(enrollments, eq(assignments.enrollmentId, enrollments.id))
    .where(eq(evidence.id, evidenceId));
  return r;
}

/** Verified needs a host or scheduler confirmation AND the trainee's debrief. Self-reporting never verifies. */
export async function verifyEvidence(db: AnyDb, actor: Actor, evidenceId: number, outcome: "verify" | "reject" = "verify") {
  const r = await loadEvidence(db, evidenceId);
  const allowed = r && (canSchedule(actor) || r.ev.hostId === actor.id || r.e.podPartnerId === actor.id);
  if (!r || !allowed || r.t.kind !== "field_immersion") {
    await audit(db, { actorId: actor.id, action: "access_denied", entity: "evidence", entityId: evidenceId });
    throw new Error("Not found");
  }
  if (r.e.traineeId === actor.id) throw new Error("You cannot verify your own activity");
  if (outcome === "reject") {
    await db.update(evidence).set({ type: "rejected", verifiedBy: actor.id }).where(eq(evidence.id, evidenceId));
    await audit(db, { actorId: actor.id, action: "reject_field_activity", entity: "evidence", entityId: evidenceId });
    return;
  }
  if (!r.ev.debrief) throw new Error("The trainee debrief is missing");
  await db.update(evidence).set({ verifiedBy: actor.id, verifiedAt: new Date(), hostId: r.ev.hostId ?? actor.id }).where(eq(evidence.id, evidenceId));
  const count = (await db.select().from(evidence).where(eq(evidence.assignmentId, r.a.id))).filter((x) => x.verifiedAt).length;
  const next = count >= r.t.requiredCount ? "verified" : "attended";
  await db.update(assignments).set({ state: next }).where(eq(assignments.id, r.a.id));
  await audit(db, { actorId: actor.id, action: "verify_field_activity", entity: "evidence", entityId: evidenceId, after: { assignment: r.a.id, state: next } });
}

/** Trainee adds a debrief to a scheduled activity that belongs to them. */
export async function addDebrief(db: AnyDb, userId: number, evidenceId: number, text: string) {
  const r = await loadEvidence(db, evidenceId);
  if (!r || r.e.traineeId !== userId) {
    await audit(db, { actorId: userId, action: "access_denied", entity: "evidence", entityId: evidenceId });
    throw new Error("Not found");
  }
  if (!text.trim()) throw new Error("Write a short debrief");
  await db.update(evidence).set({ debrief: text.trim() }).where(eq(evidence.id, evidenceId));
  await db.update(assignments).set({ state: "attended" }).where(and(eq(assignments.id, r.a.id), ne(assignments.state, "verified")));
  await audit(db, { actorId: userId, action: "add_debrief", entity: "evidence", entityId: evidenceId });
}

export async function scheduleActivity(db: AnyDb, actor: Actor, input: { assignmentId: number; hostId: number | null; date: string }) {
  if (!canSchedule(actor)) {
    await audit(db, { actorId: actor.id, action: "access_denied", entity: "schedule", entityId: input.assignmentId });
    throw new Error("Not allowed");
  }
  const [a] = await db
    .select({ a: assignments, t: programTasks })
    .from(assignments)
    .innerJoin(programTasks, eq(assignments.taskId, programTasks.id))
    .where(eq(assignments.id, input.assignmentId));
  if (!a || a.t.kind !== "field_immersion") throw new Error("Not a field activity");
  const [ev] = await db
    .insert(evidence)
    .values({ assignmentId: a.a.id, type: "field_scheduled", hostId: input.hostId, scheduledFor: input.date, scheduledBy: actor.id })
    .returning();
  await db.update(assignments).set({ state: "scheduled", dependencyId: null }).where(and(eq(assignments.id, a.a.id), ne(assignments.state, "verified")));
  await audit(db, { actorId: actor.id, action: "schedule_field_activity", entity: "evidence", entityId: ev.id, after: input });
}

/** No slot available: an organizational dependency owned by Phoebe, never a rep miss. */
export async function flagNoSlot(db: AnyDb, actor: Actor, assignmentId: number) {
  if (!canSchedule(actor)) throw new Error("Not allowed");
  const [dep] = await db
    .insert(dependencies)
    .values({ type: "install_slot", owner: "Phoebe", note: `No slot available for assignment ${assignmentId}` })
    .returning();
  await db.update(assignments).set({ dependencyId: dep.id }).where(eq(assignments.id, assignmentId));
  await audit(db, { actorId: actor.id, action: "flag_no_slot", entity: "assignment", entityId: assignmentId, after: { dependencyId: dep.id } });
}

export type BoardRow = {
  assignmentId: number;
  trainee: string;
  territory: string | null;
  activity: string;
  due: string | null;
  required: number;
  verified: number;
  scheduled: number;
  needed: number;
  blocked: boolean;
};

/** Phoebe's view: each trainee, what they still need, by when, and their territory. Field items only. */
export async function schedulingBoard(db: AnyDb, actor: Actor): Promise<BoardRow[]> {
  if (!canSchedule(actor)) throw new Error("Not allowed");
  const rows = await db
    .select({
      id: assignments.id, trainee: users.name, territory: enrollments.territory, activity: assignments.title,
      due: assignments.activeDue, required: programTasks.requiredCount, dependencyId: assignments.dependencyId,
    })
    .from(assignments)
    .innerJoin(programTasks, eq(assignments.taskId, programTasks.id))
    .innerJoin(enrollments, eq(assignments.enrollmentId, enrollments.id))
    .innerJoin(users, eq(enrollments.traineeId, users.id))
    .where(and(eq(programTasks.kind, "field_immersion"), eq(enrollments.status, "active")));
  const ev = await db.select().from(evidence);
  return rows.map((r) => {
    const mine = ev.filter((e) => e.assignmentId === r.id && e.type !== "rejected");
    const verified = mine.filter((e) => e.verifiedAt).length;
    const scheduled = mine.filter((e) => !e.verifiedAt).length;
    return {
      assignmentId: r.id, trainee: r.trainee, territory: r.territory, activity: r.activity, due: r.due,
      required: r.required, verified, scheduled, needed: Math.max(0, r.required - verified - scheduled),
      blocked: r.dependencyId != null,
    };
  });
}

export async function hostCandidates(db: AnyDb) {
  const rs = await db.select().from(roles).where(or(eq(roles.role, "host"), eq(roles.role, "pod_partner")));
  const ids = [...new Set(rs.map((r) => r.userId))];
  return ids.length ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids)) : [];
}

