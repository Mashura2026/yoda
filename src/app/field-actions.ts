"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { loadActor } from "@/lib/authz";
import { addDebrief, flagNoSlot, scheduleActivity, verifyEvidence } from "@/lib/field";
import { requireUserId } from "@/lib/session";

async function actor() {
  return loadActor(getDb(), await requireUserId());
}

export async function verifyAction(f: FormData) {
  await verifyEvidence(getDb(), await actor(), Number(f.get("evidenceId")), f.get("outcome") === "reject" ? "reject" : "verify");
  revalidatePath("/host");
  revalidatePath("/schedule");
}

export async function scheduleAction(f: FormData) {
  const date = String(f.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Pick a date");
  await scheduleActivity(getDb(), await actor(), {
    assignmentId: Number(f.get("assignmentId")),
    hostId: f.get("hostId") ? Number(f.get("hostId")) : null,
    date,
  });
  revalidatePath("/schedule");
}

export async function noSlotAction(f: FormData) {
  await flagNoSlot(getDb(), await actor(), Number(f.get("assignmentId")));
  revalidatePath("/schedule");
}

export async function debriefAction(f: FormData) {
  await addDebrief(getDb(), await requireUserId(), Number(f.get("evidenceId")), String(f.get("debrief") ?? ""));
  revalidatePath("/me");
}
