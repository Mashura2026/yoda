import { connection } from "next/server";
import { isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { programTasks, settings } from "@/db/schema";

export default async function Overview() {
  await connection();
  const db = getDb();
  const pendingSettings = await db.select().from(settings).where(isNotNull(settings.pendingOwner));
  const pendingTasks = await db.select().from(programTasks).where(isNotNull(programTasks.pendingOwner));
  return (
    <>
      <h2 className="sec2">Open items by owner</h2>
      <p className="note">Items waiting on a person. Trainees never see these.</p>
      <table className="t">
        <thead><tr><th>Where</th><th>Item</th><th>Owner</th></tr></thead>
        <tbody>
          {pendingSettings.map((s) => (
            <tr key={s.key}><td>Setting</td><td>{s.description ?? s.key}</td><td><span className="todo">{s.pendingOwner}</span></td></tr>
          ))}
          {pendingTasks.map((t) => (
            <tr key={t.id}><td>Program task</td><td>{t.title}</td><td><span className="todo">{t.pendingOwner}</span></td></tr>
          ))}
          {pendingSettings.length + pendingTasks.length === 0 && <tr><td colSpan={3}>Nothing open.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
