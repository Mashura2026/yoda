import { connection } from "next/server";
import { requireAdmin } from "@/lib/session";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { roles, ROLES, users } from "@/db/schema";
import { addPerson } from "../actions";

export default async function PeoplePage() {
  await connection();
  await requireAdmin(); // must run before any query: the layout guard does not stop a page from rendering
  const db = getDb();
  const people = await db.select().from(users).orderBy(asc(users.name));
  const allRoles = await db.select().from(roles);
  return (
    <>
      <h2 className="sec2">People and roles</h2>
      <form action={addPerson} className="card">
        <div className="fields">
          <div><label>Name</label><input name="name" required /></div>
          <div className="span2"><label>Microsoft 365 email</label><input name="email" type="email" required /></div>
          <div><label>Slack user ID</label><input name="slack" /></div>
          <div><label>Timezone</label><input name="timezone" defaultValue="America/Chicago" /></div>
          <div><label>Track (for manager)</label>
            <select name="track" defaultValue=""><option value="">None</option><option>RSD</option><option>SDR</option></select>
          </div>
          <div className="full">
            <label>Roles</label>
            {ROLES.map((r) => (
              <label key={r} style={{ display: "inline-block", marginRight: 14, textTransform: "none", letterSpacing: 0, fontSize: 13 }}>
                <input type="checkbox" name="role" value={r} style={{ width: "auto" }} /> {r}
              </label>
            ))}
          </div>
        </div>
        <div className="card-actions"><span /><button className="btn">Save person</button></div>
      </form>
      <table className="t">
        <thead><tr><th>Name</th><th>Email</th><th>Timezone</th><th>Roles</th></tr></thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td><td>{p.email}</td><td>{p.timezone}</td>
              <td>{allRoles.filter((r) => r.userId === p.id).map((r) => (r.track ? `${r.role} (${r.track})` : r.role)).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
