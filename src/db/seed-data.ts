// Program templates loaded as editable data. Nothing here is invented content:
// items without a source in the Yoda brief are TODO placeholders owned by a named person.
import type { holidays, programTasks, settings } from "./schema";

type Task = Omit<typeof programTasks.$inferInsert, "programId">;

export const SHARED_CORE: Task[] = [
  // Weeks 1 to 3 shared core (brief section 6). Due days are PROPOSED weekly buckets.
  { code: "core-product-line", title: "Product line", dueDay: 7, sortOrder: 10, pendingOwner: "Suzi (confirm due day)" },
  { code: "core-value-themes", title: "The four value themes: COGS, compliance, time and labor, missed charges", dueDay: 7, sortOrder: 20, pendingOwner: "Suzi (confirm due day)" },
  { code: "core-challenger", title: "Challenger basics", dueDay: 14, sortOrder: 30, pendingOwner: "Suzi (confirm due day)" },
  { code: "core-sf-stages", title: "Salesforce stages and forecast categories", dueDay: 14, sortOrder: 40, pendingOwner: "Suzi (confirm due day)" },
  { code: "core-deal-types", title: "Deal types", dueDay: 21, sortOrder: 50, pendingOwner: "Suzi (confirm due day)" },
  { code: "core-dealhub", title: "DealHub and the Approval Matrix", dueDay: 21, sortOrder: 60, pendingOwner: "Suzi (confirm due day)" },
  { code: "core-sf-basics", title: "Salesforce basics", dueDay: 21, sortOrder: 70, pendingOwner: "Suzi (confirm due day)" },
];

const FIELD: Task[] = [
  { code: "field-call-observe", title: "Observe sales calls led by a current RSD", kind: "field_immersion", dueDay: 30, requiredCount: 2, evidenceRequired: true, requiresHostVerification: true, dependencyType: "install_slot", sortOrder: 200 },
  { code: "field-preimpl", title: "Attend customer pre-implementation calls", kind: "field_immersion", dueDay: 60, requiredCount: 4, evidenceRequired: true, requiresHostVerification: true, dependencyType: "install_slot", sortOrder: 210 },
  { code: "field-install", title: "Attend customer installations", kind: "field_immersion", dueDay: 60, requiredCount: 2, evidenceRequired: true, requiresHostVerification: true, dependencyType: "install_slot", sortOrder: 220 },
];

export const RSD_TASKS: Task[] = [
  ...FIELD,
  { code: "rsd-module-d", title: "Module D: SDR partnership working agreement", dueAnchor: "partner_start", dueOffsetDays: 30, dependencyType: "partner", sortOrder: 100 },
  { code: "rsd-inherited-book", title: "List inherited book by Opportunity ID", dueDay: 1, evidenceRequired: true, sortOrder: 5 },
  { code: "rsd-territory-plan", title: "Present territory plan to Suzi and Anton", dueDay: 90, evidenceRequired: true, sortOrder: 300 },
  { code: "rsd-template-pending", title: "RSD weekly sequence and Modules A to H", dueDay: 90, sortOrder: 999, placeholder: true, pendingOwner: "Suzi (approve v1.1 sections 4 and 5 before October 19, 2026)" },
];

export const SDR_TASKS: Task[] = [
  ...FIELD,
  { code: "sdr-weeks-4-13-pending", title: "SDR weeks 4 to 13", dueDay: 90, sortOrder: 999, placeholder: true, pendingOwner: "Mike McQuarie (draft by early November 2026)" },
];

export const GATES = [
  { day: 30, name: "Day 30 gate" },
  { day: 60, name: "Day 60 gate" },
  { day: 90, name: "Day 90 review" },
];

export const SETTINGS: (typeof settings.$inferInsert)[] = [
  { key: "ladder.nudge_after_days_overdue", value: 1, description: "Private Slack nudge, daily until resolved" },
  { key: "ladder.yellow_business_days", value: 5, description: "Yellow to the follow-up owner" },
  { key: "ladder.red_business_days", value: 10, description: "Red, Suzi owns" },
  { key: "gate.decision_business_days", value: 3, description: "Proposed window for the certifier to record a decision" },
  { key: "gate.max_extensions", value: 1, description: "One 30-day extension per trainee" },
  { key: "gate.extension_days", value: 30 },
  { key: "target.rsd.net_bookings", value: 280000, description: "RSD Day 90 sourced Net Bookings" },
  { key: "target.rsd.pipeline_multiple", value: 2, description: "Commit + Upside as a multiple of next quarter's quota" },
  { key: "target.sdr.net_bookings", value: 100000, description: "Provisional; Mike may recalibrate in week 1" },
  { key: "target.sdr.appointments", value: null, description: "Qualified appointments by Day 90", pendingOwner: "Mike McQuarie" },
  { key: "dependency.docebo_go_live", value: "2026-11-01", description: "If it slips, bridge tasks stay active" },
  { key: "dependency.docebo_bridge_counts", value: null, description: "Do bridge completions count or must Docebo courses be re-taken", pendingOwner: "Suzi (decide before November 1, 2026)" },
  { key: "daily_job.local_hour", value: 8, description: "Daily job runs after each trainee's local morning" },
];

// Holidays are NOT seeded. TODO(Suzi): confirm company holiday calendar.
export const HOLIDAYS: (typeof holidays.$inferInsert)[] = [];
