import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { loadActor } from "@/lib/authz";
import { formatLongDate } from "@/lib/dates";
import { gatesForCertifier } from "@/lib/gates";
import { requireUserId } from "@/lib/session";
import Header from "@/components/Header";

export default async function GatesPage() {
  await connection();
  const userId = await requireUserId(); // before any query
  const db = getDb();
  const actor = await loadActor(db, userId);
  const rows = await gatesForCertifier(db, actor);
  return (
    <>
      <Header title="Gates and certification" wide />
      <main className="wrap wide pad-bottom">
        <p className="note">Yoda builds the evidence. You decide. Yoda never certifies, fails or recommends an outcome.</p>
        <table className="t">
          <thead><tr><th>Trainee</th><th>Track</th><th>Gate</th><th>Target date</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.enrollmentId}-${r.gateDay}`}>
                <td>{r.trainee}</td><td>{r.track}</td><td>Day {r.gateDay}</td><td>{formatLongDate(r.target)}</td>
                <td>{r.decided ? "Decision recorded" : r.overdueDecision ? "Decision needed" : "Upcoming"}</td>
                <td><Link className="btn" href={`/packet/${r.enrollmentId}/${r.gateDay}`}>Open packet</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6}>No gates in your scope.</td></tr>}
          </tbody>
        </table>
      </main>
    </>
  );
}
