import { connection } from "next/server";
import { requireAdmin } from "@/lib/session";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { enrollments, users } from "@/db/schema";
import { academyDay, formatLongDate, onOrBeforeWorkingDay } from "@/lib/dates";
import { holidays } from "@/db/schema";
import { createEnrollment } from "../actions";

export default async function EnrollmentsPage() {
  await connection();
  await requireAdmin(); // must run before any query: the layout guard does not stop a page from rendering
  const db = getDb();
  const all = await db.select().from(users).orderBy(users.name);
  const hol = new Set((await db.select().from(holidays)).map((h) => h.date));
  const rows = await db.select().from(enrollments).orderBy(desc(enrollments.day1));
  const name = (id: number | null) => all.find((u) => u.id === id)?.name ?? "";
  const options = all.map((u) => <option key={u.id} value={u.id}>{u.name}</option>);
  return (
    <>
      <h2 className="sec2">Enroll a trainee</h2>
      <form action={createEnrollment} className="card">
        <div className="fields">
          <div><label>Trainee</label><select name="traineeId" required>{options}</select></div>
          <div><label>Track</label><select name="track"><option>RSD</option><option>SDR</option></select></div>
          <div><label>Day 1</label><input type="date" name="day1" required /></div>
          <div><label>Manager</label><select name="managerId" defaultValue=""><option value="" />{options}</select></div>
          <div><label>Pod partner</label><select name="podPartnerId" defaultValue=""><option value="" />{options}</select></div>
          <div><label>Partner start (optional)</label><input type="date" name="partnerStart" /></div>
          <div className="full">
            <label style={{ textTransform: "none", letterSpacing: 0 }}><input type="checkbox" name="provisional" style={{ width: "auto" }} /> Day 1 is provisional</label>
          </div>
        </div>
        <div className="card-actions"><span className="note">Creates an independent copy of the track calendar.</span><button className="btn">Enroll</button></div>
      </form>
      <h2 className="sec2">Enrollments</h2>
      <table className="t">
        <thead><tr><th>Trainee</th><th>Track</th><th>Day 1</th><th>Day 30</th><th>Day 60</th><th>Day 90 review</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td>{name(e.traineeId)}</td>
              <td>{e.track}</td>
              <td>{formatLongDate(e.day1)}{e.provisional ? " (provisional)" : ""}</td>
              <td>{formatLongDate(academyDay(e.day1, 30))}</td>
              <td>{formatLongDate(academyDay(e.day1, 60))}</td>
              <td>{formatLongDate(onOrBeforeWorkingDay(academyDay(e.day1, 90), hol))}</td>
              <td>{e.status}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7}>No enrollments yet.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
