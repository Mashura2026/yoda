import { and, desc, eq, inArray } from "drizzle-orm";
import { assignments, dependencies, enrollments, programs, programTasks, users } from "@/db/schema";
import type { AnyDb } from "@/db/types";
import { academyDay, addDays, type LocalDate } from "./dates";
import { audit } from "./audit";

export type EnrollInput = {
  traineeId: number;
  track: "RSD" | "SDR";
  day1: LocalDate;
  managerId?: number | null;
  podPartnerId?: number | null;
  partnerStart?: LocalDate | null;
  provisional?: boolean;
  actorId: number | null;
};

async function latestPublished(db: AnyDb, track: "RSD" | "SDR" | "SHARED") {
  const [p] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.track, track), eq(programs.published, true)))
    .orderBy(desc(programs.version))
    .limit(1);
  return p;
}

/**
 * Creates an independent copy of the track calendar (shared core plus track tasks).
 * Later template edits never change this enrollment unless an admin applies them.
 */
export async function enroll(db: AnyDb, input: EnrollInput) {
  const [trainee] = await db.select().from(users).where(eq(users.id, input.traineeId));
  if (!trainee) throw new Error("Trainee not found");
  const program = await latestPublished(db, input.track);
  if (!program) throw new Error(`No published ${input.track} program`);
  const shared = await latestPublished(db, "SHARED");

  const [enrollment] = await db
    .insert(enrollments)
    .values({
      traineeId: input.traineeId,
      track: input.track,
      programId: program.id,
      day1: input.day1,
      timezone: trainee.timezone,
      managerId: input.managerId ?? null,
      podPartnerId: input.podPartnerId ?? null,
      partnerStart: input.partnerStart ?? null,
      provisional: input.provisional ?? false,
    })
    .returning();

  const tasks = await db
    .select()
    .from(programTasks)
    .where(inArray(programTasks.programId, shared ? [program.id, shared.id] : [program.id]));

  let partnerDependencyId: number | null = null;
  for (const t of tasks) {
    let due: LocalDate | null = null;
    let dependencyId: number | null = null;
    if (t.dueAnchor === "day1" && t.dueDay != null) {
      due = academyDay(input.day1, t.dueDay);
    } else if (t.dueAnchor === "partner_start") {
      if (input.partnerStart) {
        due = addDays(input.partnerStart, t.dueOffsetDays ?? 0);
      } else {
        // No partner yet: an organizational dependency, never a rep miss.
        if (partnerDependencyId === null) {
          const [d] = await db
            .insert(dependencies)
            .values({ type: "partner", owner: "Suzi Minahan", note: `No SDR partner for enrollment ${enrollment.id}` })
            .returning();
          partnerDependencyId = d.id;
        }
        dependencyId = partnerDependencyId;
      }
    }
    await db.insert(assignments).values({
      enrollmentId: enrollment.id,
      taskId: t.id,
      title: t.title,
      originalDue: due,
      activeDue: due,
      dependencyId,
    });
  }

  await audit(db, { actorId: input.actorId, action: "enroll", entity: "enrollment", entityId: enrollment.id, after: enrollment });
  return enrollment;
}
