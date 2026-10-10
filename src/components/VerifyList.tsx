import { formatLongDate } from "@/lib/dates";
import type { VerifyItem } from "@/lib/field";
import { verifyAction } from "@/app/field-actions";

export default function VerifyList({ items }: { items: VerifyItem[] }) {
  if (items.length === 0) return <div className="banner">Nothing waiting for you.</div>;
  return (
    <>
      {items.map((i) => (
        <div key={i.evidenceId} className="card">
          <div className="card-top">
            <div className="kr">{i.activity}</div>
            <div className="krid">{i.scheduledFor ? formatLongDate(i.scheduledFor) : "No date"}</div>
          </div>
          <div className="meta"><span>{i.trainee}</span></div>
          <p className="note" style={{ marginTop: 8 }}>
            {i.debrief ? <>Trainee debrief: {i.debrief}</> : "The trainee has not added a debrief yet. You can verify once they do."}
          </p>
          <div className="card-actions">
            <form action={verifyAction}>
              <input type="hidden" name="evidenceId" value={i.evidenceId} />
              <input type="hidden" name="outcome" value="reject" />
              <button className="btn">It did not happen</button>
            </form>
            <form action={verifyAction}>
              <input type="hidden" name="evidenceId" value={i.evidenceId} />
              <button className="btn" disabled={!i.debrief}>Confirm it happened</button>
            </form>
          </div>
        </div>
      ))}
    </>
  );
}
