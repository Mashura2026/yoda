import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { users } from "@/db/schema";
import { getDb } from "@/db/client";
import { loadActor, type Actor } from "./authz";

/** Resolves the signed-in Microsoft account to a Yoda user. Throws when not allowed. */
export async function requireAdmin(): Promise<Actor> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) redirect("/api/auth/signin");
  const db = getDb();
  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (!u) throw new Error("Not a Yoda user");
  const actor = await loadActor(db, u.id);
  if (!actor.roles.some((r) => r.role === "admin" || r.role === "program_owner")) {
    throw new Error("Admin access required");
  }
  return actor;
}

/** Resolves the signed-in Microsoft account to a Yoda user id. */
export async function requireUserId(): Promise<number> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) redirect("/api/auth/signin");
  const [u] = await getDb().select().from(users).where(eq(users.email, email));
  if (!u) throw new Error("Not a Yoda user");
  return u.id;
}
