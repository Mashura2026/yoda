import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/db/schema";
import { seedPrograms } from "../src/db/seed";
import type { AnyDb } from "../src/db/types";

export async function testDb() {
  const client = new PGlite();
  const dir = join(__dirname, "../drizzle");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(join(dir, f), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await client.exec(stmt);
    }
  }
  const db = drizzle(client, { schema }) as unknown as AnyDb;
  await seedPrograms(db);
  const mk = async (email: string, name: string, role?: string, track?: "RSD" | "SDR") => {
    const [u] = await db.insert(schema.users).values({ email, name }).returning();
    if (role) await db.insert(schema.roles).values({ userId: u.id, role, track: track ?? null });
    return u;
  };
  const suzi = await mk("suzi@example.test", "Suzi", "program_owner");
  const mike = await mk("mike@example.test", "Mike", "manager", "SDR");
  const louis = await mk("louis@example.test", "Louis", "trainee");
  const colin = await mk("colin@example.test", "Colin", "trainee");
  const newSdr = await mk("newsdr@example.test", "New SDR", "trainee");
  return { db, suzi, mike, louis, colin, newSdr };
}
