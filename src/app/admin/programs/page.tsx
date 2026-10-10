import { connection } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { programs, programTasks } from "@/db/schema";
import { updateTask } from "../actions";

export default async function ProgramsPage() {
  await connection();
  const db = getDb();
  const progs = await db.select().from(programs).orderBy(asc(programs.track), asc(programs.version));
  const sections = await Promise.all(
    progs.map(async (p) => ({ p, tasks: await db.select().from(programTasks).where(eq(programTasks.programId, p.id)).orderBy(asc(programTasks.sortOrder)) })),
  );
  return (
    <>
      <h2 className="sec2">Programs</h2>
      <p className="note">
        Template edits never change active trainees unless you tick &quot;Apply to active trainees&quot;. Applied changes are logged per assignment.
      </p>
      {sections.map(({ p, tasks }) => (
        <section key={p.id}>
          <h3 className="grp">{p.name} (v{p.version}, {p.track})</h3>
          <table className="t">
            <thead><tr><th>Task</th><th>Due day</th><th>Anchor</th><th>Open item</th><th /></tr></thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <form action={updateTask} id={`t-${t.id}`}>
                      <input type="hidden" name="id" value={t.id} />
                      <input name="title" defaultValue={t.title} />
                    </form>
                  </td>
                  <td><input form={`t-${t.id}`} name="dueDay" type="number" defaultValue={t.dueDay ?? ""} style={{ width: 80 }} /></td>
                  <td>{t.dueAnchor}</td>
                  <td>{t.pendingOwner ? <span className="todo">{t.pendingOwner}</span> : null}</td>
                  <td>
                    <label style={{ display: "inline", textTransform: "none", letterSpacing: 0 }}>
                      <input form={`t-${t.id}`} type="checkbox" name="apply" style={{ width: "auto" }} /> Apply to active trainees
                    </label>{" "}
                    <button className="btn" form={`t-${t.id}`}>Save</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}
