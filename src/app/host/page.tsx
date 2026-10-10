import { connection } from "next/server";
import { getDb } from "@/db/client";
import { loadActor } from "@/lib/authz";
import { listVerifiable } from "@/lib/field";
import { requireUserId } from "@/lib/session";
import Header from "@/components/Header";
import VerifyList from "@/components/VerifyList";

export default async function HostPage() {
  await connection();
  const userId = await requireUserId(); // before any query
  const db = getDb();
  const actor = await loadActor(db, userId);
  const ok = actor.roles.some((r) => ["host", "pod_partner", "scheduler", "admin", "program_owner"].includes(r.role));
  if (!ok) throw new Error("Not allowed");
  const items = await listVerifiable(db, actor);
  return (
    <>
      <Header title="Confirm field activity" />
      <main className="wrap pad-bottom">
        <p className="note">Confirm what you saw. A trainee&apos;s own report never counts without your confirmation and their debrief.</p>
        <VerifyList items={items} />
      </main>
    </>
  );
}
