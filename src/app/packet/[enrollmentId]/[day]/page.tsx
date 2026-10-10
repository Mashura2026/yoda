import { connection } from "next/server";
import { getDb } from "@/db/client";
import { loadActor } from "@/lib/authz";
import { formatLongDate } from "@/lib/dates";
import { buildPacket } from "@/lib/gates";
import { requireUserId } from "@/lib/session";
import Header from "@/components/Header";
import { decideAction } from "@/app/gate-actions";

export default async function PacketPage({ params }: { params: Promise<{ enrollmentId: string; day: string }> }) {
  await connection();
  const userId = await requireUserId(); // before any query
  const { enrollmentId, day } = await params;
  const db = getDb();
  const actor = await loadActor(db, userId);
  const p = await buildPacket(db, actor, Number(enrollmentId), Number(day)); // denies and logs cross-trainee access
  return (
    <>
      <Header title={`Day ${p.gateDay} evidence packet`} who={p.trainee} wide />
      <main className="wrap wide pad-bottom">
        <dl className="kv">
          <dt>Track</dt><dd>{p.track}</dd>
          <dt>Target date</dt><dd>{formatLongDate(p.target)}</dd>
          <dt>Review meets</dt><dd>{formatLongDate(p.review)}</dd>
          {p.extendedTo ? (<><dt>Extended to</dt><dd>{formatLongDate(p.extendedTo)}</dd></>) : null}
        </dl>

        <h2 className="sec2">Tasks</h2>
        <table className="t">
          <thead><tr><th>Task</th><th>Due</th><th>State</th></tr></thead>
          <tbody>
            {p.tasks.map((t, i) => (
              <tr key={i}><td>{t.title}</td><td>{t.due ? formatLongDate(t.due) : ""}</td><td>{t.late ? "Overdue" : t.state}</td></tr>
            ))}
          </tbody>
        </table>

        <h2 className="sec2">Field immersion</h2>
        <table className="t">
          <thead><tr><th>Activity</th><th>Verified</th><th>Due</th></tr></thead>
          <tbody>
            {p.field.map((f, i) => (
              <tr key={i}><td>{f.title}</td><td>{f.verified} of {f.required}</td><td>{f.due ? formatLongDate(f.due) : ""}</td></tr>
            ))}
          </tbody>
        </table>

        <h2 className="sec2">Missed and deferred</h2>
        <p className="note">Missed: {p.missed.length ? p.missed.join(", ") : "none"}.</p>
        <p className="note">Deferred by a company dependency (not counted against the trainee): {p.deferred.length ? p.deferred.join(", ") : "none"}.</p>

        <h2 className="sec2">Salesforce</h2>
        <div className="banner">{p.salesforce}</div>

        <h2 className="sec2">Manager notes</h2>
        <p className="note">{p.managerNotes}</p>

        <h2 className="sec2">Decision</h2>
        {p.decision ? (
          <div className="banner ok">
            {p.decision.outcome.replace(/_/g, " ")}, recorded by {p.decision.decidedBy} on {p.decision.decidedAt.toISOString().slice(0, 10)}. {p.decision.rationale}
          </div>
        ) : p.canDecide ? (
          <form action={decideAction} className="card">
            <input type="hidden" name="enrollmentId" value={p.enrollmentId} />
            <input type="hidden" name="gateDay" value={p.gateDay} />
            <div className="fields" style={{ gridTemplateColumns: "1fr" }}>
              <div>
                <label>Outcome</label>
                <select name="outcome" defaultValue="">
                  <option value="" disabled>Choose</option>
                  <option value="certified">Certified</option>
                  <option value="development_plan">Development plan</option>
                  <option value="approved_extension">Approved extension (30 days, once)</option>
                </select>
              </div>
              <div><label>Rationale (required)</label><textarea name="rationale" required /></div>
              <div><label>Recovery plan (required for an extension)</label><textarea name="recoveryPlan" /></div>
            </div>
            <div className="card-actions"><span /><button className="btn">Record decision</button></div>
          </form>
        ) : (
          <div className="banner">No decision recorded yet.</div>
        )}
      </main>
    </>
  );
}
