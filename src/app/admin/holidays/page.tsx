import { connection } from "next/server";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { holidays } from "@/db/schema";
import { formatLongDate } from "@/lib/dates";
import { addHoliday, removeHoliday } from "../actions";

export default async function HolidaysPage() {
  await connection();
  const rows = await getDb().select().from(holidays).orderBy(asc(holidays.date));
  return (
    <>
      <h2 className="sec2">Company holidays</h2>
      <p className="note">
        Overdue clocks skip these days. <span className="todo">TODO(Suzi): confirm the calendar.</span> Thanksgiving, Christmas and New Year&apos;s fall inside this cohort.
      </p>
      <form action={addHoliday} className="controls">
        <input type="date" name="date" required />
        <input name="name" placeholder="Name" required />
        <button className="btn">Add</button>
      </form>
      <table className="t">
        <thead><tr><th>Date</th><th>Name</th><th /></tr></thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.date}>
              <td>{formatLongDate(h.date)}</td>
              <td>{h.name}</td>
              <td>
                <form action={removeHoliday}>
                  <input type="hidden" name="date" value={h.date} />
                  <button className="btn">Remove</button>
                </form>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={3}>No holidays entered yet.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
