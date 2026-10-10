import { and, eq, isNotNull } from "drizzle-orm";
import { assignments, enrollments, evidence, holidays, programTasks } from "@/db/schema";
import type { AnyDb } from "@/db/types";
import { academyDay, addDays, daysBetween, localToday, onOrBeforeWorkingDay, type LocalDate } from "./dates";

export type TaskRow = {
  id: number;
  title: string;
  due: LocalDate | null;
  state: string;
  kind: string;
  evidenceRequired: boolean;
  requiresHostVerification: boolean;
  verified: number;
  required: number;
  waiting: boolean; // organizational dependency, never counts against the trainee
};

export type TraineeView = {
  enrollmentId: number;
  track: "RSD" | "SDR";
  today: LocalDate;
  day: number;
  gate: { day: number; target: LocalDate; review: LocalDate; daysLeft: number } | null;
  overdue: TaskRow[];
  dueToday: TaskRow[];
  thisWeek: TaskRow[];
  later: TaskRow[];
  waiting: TaskRow[];
  done: TaskRow[];
  field: TaskRow[];
};

const OPEN = new Set(["pending", "scheduled", "attended"]);

/**
 * Builds the dashboard for the signed-in trainee only. The enrollment is found from the
 * user id, never from a client-supplied enrollment id, so no other trainee's data is reachable.
 */
export async function traineeView(db: AnyDb, userId: number, now: Date = new Date()): Promise<TraineeView | null> {
  const [e] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.traineeId, userId), eq(enrollments.status, "active")));
  if (!e) return null;

  const today = localToday(e.timezone, now);
  const hol = new Set((await db.select().from(holidays)).map((h) => h.date));

  const rows = await db
    .select({
      id: assignments.id,
      title: assignments.title,
      due: assignments.activeDue,
      state: assignments.state,
      dependencyId: assignments.dependencyId,
      kind: programTasks.kind,
      evidenceRequired: programTasks.evidenceRequired,
      requiresHostVerification: programTasks.requiresHostVerification,
      required: programTasks.requiredCount,
      placeholder: programTasks.placeholder,
      sortOrder: programTasks.sortOrder,
    })
    .from(assignments)
    .innerJoin(programTasks, eq(assignments.taskId, programTasks.id))
    .where(eq(assignments.enrollmentId, e.id));

  const ver = await db
    .select({ assignmentId: evidence.assignmentId })
    .from(evidence)
    .innerJoin(assignments, eq(evidence.assignmentId, assignments.id))
    .where(and(eq(assignments.enrollmentId, e.id), isNotNull(evidence.verifiedAt)));
  const verified = new Map<number, number>();
  for (const v of ver) verified.set(v.assignmentId, (verified.get(v.assignmentId) ?? 0) + 1);

  const view: TraineeView = {
    enrollmentId: e.id,
    track: e.track === "SDR" ? "SDR" : "RSD",
    today,
    day: daysBetween(e.day1, today) + 1,
    gate: null,
    overdue: [], dueToday: [], thisWeek: [], later: [], waiting: [], done: [], field: [],
  };

  for (const g of [30, 60, 90]) {
    const target = academyDay(e.day1, g);
    if (target >= today) {
      view.gate = { day: g, target, review: onOrBeforeWorkingDay(target, hol), daysLeft: daysBetween(today, target) };
      break;
    }
  }

  const weekEnd = addDays(today, 7);
  rows.sort((a, b) => a.sortOrder - b.sortOrder);
  for (const r of rows) {
    if (r.placeholder) continue; // empty slots are for admins; trainees never see an empty item
    const t: TaskRow = {
      id: r.id, title: r.title, due: r.due, state: r.state, kind: r.kind,
      evidenceRequired: r.evidenceRequired, requiresHostVerification: r.requiresHostVerification,
      verified: verified.get(r.id) ?? 0, required: r.required,
      waiting: r.dependencyId != null && r.due == null,
    };
    if (r.kind === "field_immersion") view.field.push(t);
    const complete = r.state === "done" || r.state === "verified" || r.state === "waived" ||
      (r.requiresHostVerification && t.verified >= t.required);
    if (complete) view.done.push(t);
    else if (t.waiting) view.waiting.push(t);
    else if (!OPEN.has(r.state) || !r.due) view.later.push(t);
    else if (r.due < today) view.overdue.push(t);
    else if (r.due === today) view.dueToday.push(t);
    else if (r.due <= weekEnd) view.thisWeek.push(t);
    else view.later.push(t);
  }
  return view;
}
