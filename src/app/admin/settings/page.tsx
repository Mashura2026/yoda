import { connection } from "next/server";
import { requireAdmin } from "@/lib/session";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import { updateSetting } from "../actions";

export default async function SettingsPage() {
  await connection();
  await requireAdmin(); // must run before any query: the layout guard does not stop a page from rendering
  const rows = await getDb().select().from(settings).orderBy(asc(settings.key));
  return (
    <>
      <h2 className="sec2">Settings</h2>
      <p className="note">Targets, thresholds and dates. Changes take effect immediately and are logged. Values are JSON or plain text.</p>
      <table className="t">
        <thead><tr><th>Key</th><th>Value</th><th>Notes</th><th /></tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.key}>
              <td><code>{s.key}</code></td>
              <td>
                <form action={updateSetting} id={`f-${s.key}`}>
                  <input type="hidden" name="key" value={s.key} />
                  <input name="value" defaultValue={s.value === null ? "" : JSON.stringify(s.value)} />
                </form>
              </td>
              <td>
                {s.description}
                {s.pendingOwner ? <> <span className="todo">{s.pendingOwner}</span></> : null}
              </td>
              <td><button className="btn" form={`f-${s.key}`}>Save</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
