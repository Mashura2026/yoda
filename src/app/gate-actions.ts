"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { loadActor } from "@/lib/authz";
import { recordDecision } from "@/lib/gates";
import { requireUserId } from "@/lib/session";

export async function decideAction(f: FormData) {
  const db = getDb();
  const actor = await loadActor(db, await requireUserId());
  const enrollmentId = Number(f.get("enrollmentId"));
  const gateDay = Number(f.get("gateDay"));
  const outcome = String(f.get("outcome"));
  if (!["certified", "development_plan", "approved_extension"].includes(outcome)) throw new Error("Choose an outcome");
  await recordDecision(db, actor, {
    enrollmentId,
    gateDay,
    outcome: outcome as "certified" | "development_plan" | "approved_extension",
    rationale: String(f.get("rationale") ?? ""),
    recoveryPlan: String(f.get("recoveryPlan") ?? ""),
  });
  redirect(`/packet/${enrollmentId}/${gateDay}`);
}
