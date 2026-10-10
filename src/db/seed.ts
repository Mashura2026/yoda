import { gates, holidays, programs, programTasks, settings } from "./schema";
import type { AnyDb } from "./types";
import { GATES, HOLIDAYS, RSD_TASKS, SDR_TASKS, SETTINGS, SHARED_CORE } from "./seed-data";

export async function seedPrograms(db: AnyDb) {
  for (const [track, tasks, name] of [
    ["SHARED", SHARED_CORE, "Shared core"],
    ["RSD", RSD_TASKS, "RSD program"],
    ["SDR", SDR_TASKS, "SDR program"],
  ] as const) {
    const [p] = await db.insert(programs).values({ track, version: 1, name, published: true }).returning();
    await db.insert(programTasks).values(tasks.map((t) => ({ ...t, programId: p.id, shared: track === "SHARED" })));
    if (track !== "SHARED") await db.insert(gates).values(GATES.map((g) => ({ ...g, programId: p.id })));
  }
  await db.insert(settings).values(SETTINGS).onConflictDoNothing();
  if (HOLIDAYS.length) await db.insert(holidays).values(HOLIDAYS).onConflictDoNothing();
}
