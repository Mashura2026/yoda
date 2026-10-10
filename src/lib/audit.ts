import { auditLog } from "@/db/schema";
import type { AnyDb } from "@/db/types";

export async function audit(
  db: AnyDb,
  entry: { actorId: number | null; action: string; entity: string; entityId?: string | number; before?: unknown; after?: unknown },
) {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId === undefined ? null : String(entry.entityId),
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}
