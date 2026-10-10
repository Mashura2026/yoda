import { connection } from "next/server";
import { getDb } from "@/db/client";
import { formatLongDate } from "@/lib/dates";
import { requireUserId } from "@/lib/session";
import { traineeView, type TaskRow } from "@/lib/trainee";
import Header from "@/components/Header";
import { markDone, submitEvidence } from "./actions";

function Task({ t, tone }: { t: TaskRow; tone?: "late" }) {
  const needsEvidence = t.evidenceRequired || t.requiresHostVerification;
  return (
    <div className="card" style={tone === "late" ? { borderLeft: "4px solid var(--red)" } : undefined}>
      <div className="card-top">
        <div className="kr">{t.title}</div>
        {t.due ? <div className="krid">Due {formatLongDate(t.due)}</div> : null}
      </div>
      {t.kind === "field_immersion" ? (
        <div className="meta"><span>{t.verified} of {t.required} verified</span>{t.state === "attended" ? <span>Waiting on host confirmation</span> : null}</div>
      ) : null}
      {t.state === "done" || t.state === "verified" ? null : needsEvidence ? (
        <details style={{ marginTop: 10 }}>
          <summary className="btn" style={{ display: "inline-block" }}>Add evidence</summary>
          <form action={submitEvidence} className="fields" style={{ gridTemplateColumns: "1fr" }}>
            <input type="hidden" name="assignmentId" value={t.id} />
            <div><label>Link (optional)</label><input name="link" placeholder="https://" /></div>
            <div><label>{t.requiresHostVerification ? "Debrief (required)" : "Note"}</label><textarea name="debrief" /></div>
            <div><button className="btn">Submit</button></div>
          </form>
        </details>
      ) : (
        <form action={markDone} style={{ marginTop: 10 }}>
          <input type="hidden" name="assignmentId" value={t.id} />
          <button className="btn">Mark done</button>
        </form>
      )}
    </div>
  );
}

function Group({ title, rows, tone }: { title: string; rows: TaskRow[]; tone?: "late" }) {
  if (rows.length === 0) return null;
  return (
    <section className="group">
      <h2>{title}</h2>
      {rows.map((t) => <Task key={t.id} t={t} tone={tone} />)}
    </section>
  );
}

export default async function MyAcademy() {
  await connection();
  const userId = await requireUserId(); // before any query
  const v = await traineeView(getDb(), userId);
  if (!v) {
    return (
      <>
        <Header title="Sales Academy" />
        <main className="wrap"><div className="banner">You are not enrolled yet. Suzi or Mike will set up your calendar.</div></main>
      </>
    );
  }
  return (
    <>
      <Header title="Your 90 days" who={`Day ${Math.max(v.day, 1)} of 90`} />
      <main className="wrap pad-bottom">
        {v.gate ? (
          <div className="banner ok">
            Day {v.gate.day} gate: {v.gate.daysLeft} {v.gate.daysLeft === 1 ? "day" : "days"} away. Review on {formatLongDate(v.gate.review)}.
          </div>
        ) : null}
        <Group title="Overdue" rows={v.overdue} tone="late" />
        <Group title="Due today" rows={v.dueToday} />
        <Group title="This week" rows={v.thisWeek} />
        <Group title="Later" rows={v.later} />
        <Group title="Waiting on the company" rows={v.waiting} />
        {v.field.length ? (
          <section className="group">
            <h2>Field immersion</h2>
            <div className="tiles" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {v.field.map((t) => (
                <div key={t.id} className="tile">
                  <div className="n">{t.verified}/{t.required}</div>
                  <div className="l">{t.title}</div>
                </div>
              ))}
            </div>
            <p className="note">Only host-verified activities count.</p>
          </section>
        ) : null}
        <section className="group">
          <h2>Your Day 90 numbers</h2>
          <div className="banner">Salesforce figures: pending setup.</div>
        </section>
        <Group title="Done" rows={v.done} />
      </main>
    </>
  );
}
