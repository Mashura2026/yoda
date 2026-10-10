import { and, eq, inArray } from "drizzle-orm";
import { assignments, enrollments, evidence, gateDecisions, gates, holidays, programTasks, recoveryPlans, users } from "@/db/schema";
import type { AnyDb } from "@/db/types";
import { audit } from "./audit";
import { canCertify, canViewEnrollment, type Actor } from "./authz";
import { academyDay, localToday, onOrBeforeWorkingDay, type LocalDate } from "./dates";

export type Packet = {
  enrollmentId: number;
  trainee: string;
  track: "RSD" | "SDR";
  gateDay: number;
  target: LocalDate;
  review: LocalDate;
  extendedTo: LocalDate | null;
  tasks: { title: string; due: LocalDate | null; state: string; late: boolean }[];
  field: { title: string; required: number; verified: number; due: LocalDate | null }[];
  missed: string[];
  deferred: string[];
  salesforce: string;
  managerNotes: string;
  decision: { outcome: string; decidedBy: string; rationale: string; decidedAt: Date } | null;
  canDecide: boolean;
};

const DONE = new Set(["done", "verified", "waived"]);

/** Evidence packet for one gate. Access is checked first; denied attempts are logged. */
export async function buildPacket(db: AnyDb, actor: Actor, enrollmentId: number, gateDay: number, now: Date = new Date()): Promise<Packet> {
  if (!(await canViewEnrollment(db, actor, enrollmentId))) throw new Error("Not found");
  const [e] = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId));
  const [trainee] = await db.select().from(users).where(eq(users.id, e.traineeId));
  const hol = new Set((await db.select().from(holidays)).map((h) => h.date));
  const target = academyDay(e.day1, gateDay);
  const track = e.track === "SDR" ? "SDR" : "RSD";

  const rows = await db
    .select({ a: assignments, t: programTasks })
    .from(assignments)
    .innerJoin(programTasks, eq(assignments.taskId, programTasks.id))
    .where(eq(assignments.enrollmentId, enrollmentId));
  const evs = await db.select().from(evidence).where(inArray(evidence.assignmentId, rows.length ? rows.map((r) => r.a.id) : [0]));
  const today = localToday(e.timezone, now);

  const inScope = rows.filter((r) => !r.t.placeholder && r.a.activeDue && r.a.activeDue <= target);
  const tasks = inScope.map((r) => ({
    title: r.a.title,
    due: r.a.activeDue,
    state: r.a.state,
    late: !DONE.has(r.a.state) && r.a.activeDue! < today && r.a.dependencyId == null,
  }));
  const field = inScope
    .filter((r) => r.t.kind === "field_immersion")
    .map((r) => ({
      title: r.a.title,
      required: r.t.requiredCount,
      verified: evs.filter((x) => x.assignmentId === r.a.id && x.verifiedAt).length,
      due: r.a.activeDue,
    }));

  const [gate] = await db.select().from(gates).where(and(eq(gates.programId, e.programId), eq(gates.day, gateDay)));
  const [d] = gate
    ? await db.select().from(gateDecisions).where(and(eq(gateDecisions.enrollmentId, enrollmentId), eq(gateDecisions.gateId, gate.id)))
    : [];
  let decision: Packet["decision"] = null;
  if (d) {
    const [by] = await db.select().from(users).where(eq(users.id, d.decidedBy));
    decision = { outcome: d.outcome, decidedBy: by?.name ?? "", rationale: d.rationale, decidedAt: d.decidedAt };
  }
  const ext = await db.select().from(recoveryPlans).where(eq(recoveryPlans.enrollmentId, enrollmentId));
  const extendedTo = ext.length ? academyDay(e.day1, gateDay + ext[0].extensionDays) : null;

  return {
    enrollmentId, trainee: trainee.name, track, gateDay, target,
    review: onOrBeforeWorkingDay(target, hol), extendedTo,
    tasks, field,
    missed: tasks.filter((t) => t.late).map((t) => t.title),
    deferred: rows.filter((r) => !r.t.placeholder && r.a.dependencyId != null && !DONE.has(r.a.state)).map((r) => r.a.title),
    salesforce: "Pending setup. Figures will appear here with a timestamp.",
    managerNotes: "None recorded.", // TODO(Anton): decide whether manager notes live in Yoda
    decision,
    canDecide: canCertify(actor, track) && !decision,
  };
}

export async function recordDecision(
  db: AnyDb,
  actor: Actor,
  input: { enrollmentId: number; gateDay: number; outcome: "certified" | "development_plan" | "approved_extension"; rationale: string; recoveryPlan?: string },
) {
  const [e] = await db.select().from(enrollments).where(eq(enrollments.id, input.enrollmentId));
  if (!e) throw new Error("Not found");
  const track = e.track === "SDR" ? "SDR" : "RSD";
  // Only Suzi (any track) or Mike McQuarie (SDR, as her delegate). Yoda never decides on its own.
  if (!canCertify(actor, track)) {
    await audit(db, { actorId: actor.id, action: "access_denied", entity: "gate_decision", entityId: input.enrollmentId });
    throw new Error("Not allowed");
  }
  if (!input.rationale.trim()) throw new Error("A written rationale is required");
  const [gate] = await db.select().from(gates).where(and(eq(gates.programId, e.programId), eq(gates.day, input.gateDay)));
  if (!gate) throw new Error("Unknown gate");
  const [existing] = await db.select().from(gateDecisions).where(and(eq(gateDecisions.enrollmentId, e.id), eq(gateDecisions.gateId, gate.id)));
  if (existing) throw new Error("A decision is already recorded for this gate");

  if (input.outcome === "approved_extension") {
    const prior = await db.select().from(gateDecisions).where(and(eq(gateDecisions.enrollmentId, e.id), eq(gateDecisions.outcome, "approved_extension")));
    if (prior.length >= 1) throw new Error("One extension per trainee. A second cannot be granted in Yoda.");
    if (!input.recoveryPlan?.trim()) throw new Error("An extension needs a written recovery plan");
  }

  const [d] = await db
    .insert(gateDecisions)
    .values({ enrollmentId: e.id, gateId: gate.id, outcome: input.outcome, decidedBy: actor.id, rationale: input.rationale.trim() })
    .returning();
  if (input.outcome === "approved_extension") {
    await db.insert(recoveryPlans).values({ enrollmentId: e.id, gateDecisionId: d.id, plan: input.recoveryPlan!.trim(), extensionDays: 30 });
  }
  await audit(db, { actorId: actor.id, action: "gate_decision", entity: "gate_decision", entityId: d.id, after: { enrollment: e.id, gate: input.gateDay, outcome: input.outcome } });
  return d;
}

export type PendingGate = { enrollmentId: number; trainee: string; track: string; gateDay: number; target: LocalDate; overdueDecision: boolean; decided: boolean };

/**
 * Gates the actor certifies: shows the next gate for each trainee in scope and flags those whose
 * target has passed without a decision. A missed gate asks for a decision; it never turns Red by itself.
 */
export async function gatesForCertifier(db: AnyDb, actor: Actor, now: Date = new Date()): Promise<PendingGate[]> {
  const es = await db.select().from(enrollments).where(eq(enrollments.status, "active"));
  const out: PendingGate[] = [];
  for (const e of es) {
    const track = e.track === "SDR" ? "SDR" : "RSD";
    if (!canCertify(actor, track)) continue;
    const [t] = await db.select().from(users).where(eq(users.id, e.traineeId));
    const today = localToday(e.timezone, now);
    const gs = await db.select().from(gates).where(eq(gates.programId, e.programId));
    const decs = await db.select().from(gateDecisions).where(eq(gateDecisions.enrollmentId, e.id));
    for (const g of gs.sort((a, b) => a.day - b.day)) {
      const target = academyDay(e.day1, g.day);
      const decided = decs.some((d) => d.gateId === g.id);
      if (decided && target < today) continue;
      out.push({ enrollmentId: e.id, trainee: t.name, track, gateDay: g.day, target, decided, overdueDecision: !decided && today > target });
      if (!decided && target >= today) break; // only the next upcoming gate
    }
  }
  return out;
}
