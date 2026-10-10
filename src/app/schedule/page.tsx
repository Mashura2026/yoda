import { connection } from "next/server";
import { getDb } from "@/db/client";
import { loadActor } from "@/lib/authz";
import { formatLongDate } from "@/lib/dates";
import { hostCandidates, listVerifiable, schedulingBoard } from "@/lib/field";
import { requireUserId } from "@/lib/session";
import Header from "@/components/Header";
import VerifyList from "@/components/VerifyList";
import { noSlotAction, scheduleAction } from "../field-actions";

export default async function SchedulePage() {
  await connection();
  const userId = await requireUserId(); // before any query
  const db = getDb();
  const actor = await loadActor(db, userId);
  const board = await schedulingBoard(db, actor); // throws unless scheduler or admin
  const hosts = await hostCandidates(db);
  const waiting = await listVerifiable(db, actor);
  return (
    <>
      <Header title="Field immersion scheduling" wide />
      <main className="wrap wide pad-bottom">
        <h2 className="sec2">What each trainee still needs</h2>
        <p className="note">Book early, mostly in November, ahead of the holidays. If no slot is available, flag it. That is a company dependency and does not count against the trainee.</p>
        <table className="t">
          <thead><tr><th>Trainee</th><th>Territory</th><th>Activity</th><th>Due</th><th>Verified</th><th>Scheduled</th><th>Still needed</th><th>Schedule</th></tr></thead>
          <tbody>
            {board.map((r) => (
              <tr key={r.assignmentId}>
                <td>{r.trainee}</td>
                <td>{r.territory ?? <span className="todo">TODO(Suzi)</span>}</td>
                <td>{r.activity}</td>
                <td>{r.due ? formatLongDate(r.due) : ""}</td>
                <td>{r.verified} of {r.required}</td>
                <td>{r.scheduled}</td>
                <td>{r.needed}{r.blocked ? " (no slot flagged)" : ""}</td>
                <td>
                  {r.needed > 0 ? (
                    <>
                      <form action={scheduleAction} className="controls">
                        <input type="hidden" name="assignmentId" value={r.assignmentId} />
                        <input type="date" name="date" required />
                        <select name="hostId" defaultValue=""><option value="">Host</option>{hosts.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
                        <button className="btn">Book</button>
                      </form>
                      {r.blocked ? null : (
                        <form action={noSlotAction}>
                          <input type="hidden" name="assignmentId" value={r.assignmentId} />
                          <button className="btn">No slot available</button>
                        </form>
                      )}
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
            {board.length === 0 && <tr><td colSpan={8}>No active trainees.</td></tr>}
          </tbody>
        </table>
        <h2 className="sec2">Confirm attendance</h2>
        <VerifyList items={waiting} />
      </main>
    </>
  );
}
