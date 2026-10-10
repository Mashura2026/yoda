import { and, eq } from "drizzle-orm";
import { enrollments, roles, type Role } from "@/db/schema";
import type { AnyDb } from "@/db/types";
import { audit } from "./audit";

export type Actor = { id: number; roles: { role: Role; track: "RSD" | "SDR" | null }[] };

export async function loadActor(db: AnyDb, userId: number): Promise<Actor> {
  const rows = await db.select().from(roles).where(eq(roles.userId, userId));
  return { id: userId, roles: rows.map((r) => ({ role: r.role as Role, track: r.track === "SHARED" ? null : r.track })) };
}

const has = (a: Actor, role: Role, track?: "RSD" | "SDR") =>
  a.roles.some((r) => r.role === role && (track === undefined || r.track === null || r.track === track));

/**
 * Server-side check for any read of a trainee's enrollment data. Every page, API route,
 * export and search must call this. Cross-trainee requests are denied and logged.
 */
export async function canViewEnrollment(db: AnyDb, actor: Actor, enrollmentId: number): Promise<boolean> {
  const [e] = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId));
  let allowed = false;
  if (e) {
    allowed =
      e.traineeId === actor.id ||
      has(actor, "admin") ||
      has(actor, "program_owner") ||
      has(actor, "ceo") ||
      (has(actor, "manager", e.track === "SDR" ? "SDR" : "RSD") && e.managerId === actor.id) ||
      (has(actor, "manager", "SDR") && e.track === "SDR");
  }
  if (!allowed) {
    await audit(db, { actorId: actor.id, action: "access_denied", entity: "enrollment", entityId: enrollmentId });
  }
  return allowed;
}

/** Only Suzi (program owner) for any track, or the track's delegate certifier, may record gate decisions. */
export function canCertify(actor: Actor, track: "RSD" | "SDR"): boolean {
  if (actor.roles.some((r) => r.role === "program_owner")) return true;
  return track === "SDR" && actor.roles.some((r) => r.role === "manager" && r.track === "SDR");
}

export async function traineeEnrollmentIds(db: AnyDb, userId: number): Promise<number[]> {
  const rows = await db.select({ id: enrollments.id }).from(enrollments).where(and(eq(enrollments.traineeId, userId)));
  return rows.map((r) => r.id);
}
