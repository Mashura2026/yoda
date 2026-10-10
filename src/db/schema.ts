import { sql } from "drizzle-orm";
import {
  boolean, date, integer, jsonb, pgEnum, pgTable, primaryKey, serial, text, timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";

export const ROLES = ["trainee", "pod_partner", "host", "manager", "program_owner", "ceo", "scheduler", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const trackEnum = pgEnum("track", ["RSD", "SDR", "SHARED"]);
export const assignmentState = pgEnum("assignment_state", ["pending", "done", "scheduled", "attended", "verified", "waived"]);
export const severityEnum = pgEnum("severity", ["nudge", "yellow", "red"]);
export const outcomeEnum = pgEnum("gate_outcome", ["certified", "development_plan", "approved_extension"]);
export const enrollmentStatus = pgEnum("enrollment_status", ["active", "paused", "completed", "withdrawn"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  slackUserId: text("slack_user_id"),
  timezone: text("timezone").notNull().default("America/Chicago"), // TODO(Anton): confirm default timezone
  active: boolean("active").notNull().default(true),
});

export const roles = pgTable("roles", {
  userId: integer("user_id").notNull().references(() => users.id),
  role: text("role").notNull(),
  track: trackEnum("track"), // scopes manager and certifier roles to a track
}, (t) => [primaryKey({ columns: [t.userId, t.role] })]);

export const programs = pgTable("programs", {
  id: serial("id").primaryKey(),
  track: trackEnum("track").notNull(),
  version: integer("version").notNull(),
  name: text("name").notNull(),
  published: boolean("published").notNull().default(false),
}, (t) => [uniqueIndex("programs_track_version").on(t.track, t.version)]);

export const programTasks = pgTable("program_tasks", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").notNull().references(() => programs.id),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  kind: text("kind").notNull().default("task"), // task | field_immersion | gate_prep
  shared: boolean("shared").notNull().default(false), // shared core, defined once, referenced by both tracks
  // Due date rule: day offset from Day 1, or relative to another anchor (e.g. partner start).
  dueAnchor: text("due_anchor").notNull().default("day1"), // day1 | partner_start
  dueDay: integer("due_day"), // academy day number when anchor is day1
  dueOffsetDays: integer("due_offset_days"), // calendar days after anchor otherwise
  evidenceRequired: boolean("evidence_required").notNull().default(false),
  requiresHostVerification: boolean("requires_host_verification").notNull().default(false),
  requiredCount: integer("required_count").notNull().default(1),
  dependencyType: text("dependency_type"), // docebo | partner | install_slot
  resourceUrl: text("resource_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  pendingOwner: text("pending_owner"), // TODO(owner) placeholder, shown to admins only
});

export const gates = pgTable("gates", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").notNull().references(() => programs.id),
  day: integer("day").notNull(), // 30, 60, 90
  name: text("name").notNull(),
  requirements: jsonb("requirements").notNull().default(sql`'[]'::jsonb`),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value"), // null while a TODO(owner) is pending
  description: text("description"),
  pendingOwner: text("pending_owner"),
});

export const holidays = pgTable("holidays", {
  date: date("date", { mode: "string" }).primaryKey(),
  name: text("name").notNull(),
});

export const enrollments = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  traineeId: integer("trainee_id").notNull().references(() => users.id),
  track: trackEnum("track").notNull(),
  programId: integer("program_id").notNull().references(() => programs.id),
  day1: date("day1", { mode: "string" }).notNull(),
  timezone: text("timezone").notNull(),
  managerId: integer("manager_id").references(() => users.id),
  podPartnerId: integer("pod_partner_id").references(() => users.id),
  partnerStart: date("partner_start", { mode: "string" }),
  provisional: boolean("provisional").notNull().default(false),
  status: enrollmentStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("enrollments_one_active").on(t.traineeId).where(sql`status = 'active'`)]);

export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => enrollments.id),
  taskId: integer("task_id").notNull().references(() => programTasks.id),
  title: text("title").notNull(), // copied at enrollment so template edits never change it silently
  originalDue: date("original_due", { mode: "string" }),
  activeDue: date("active_due", { mode: "string" }),
  state: assignmentState("state").notNull().default("pending"),
  dependencyId: integer("dependency_id"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [uniqueIndex("assignments_enrollment_task").on(t.enrollmentId, t.taskId)]);

export const dependencies = pgTable("dependencies", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  owner: text("owner").notNull(),
  expectedDate: date("expected_date", { mode: "string" }),
  status: text("status").notNull().default("open"),
  note: text("note"),
});

export const evidence = pgTable("evidence", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull().references(() => assignments.id),
  type: text("type").notNull(),
  link: text("link"),
  debrief: text("debrief"),
  hostId: integer("host_id").references(() => users.id),
  verifiedBy: integer("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => enrollments.id),
  assignmentId: integer("assignment_id").references(() => assignments.id),
  severity: severityEnum("severity").notNull(),
  rule: text("rule").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  acknowledgedBy: integer("acknowledged_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const alertDeliveries = pgTable("alert_deliveries", {
  id: serial("id").primaryKey(),
  alertId: integer("alert_id").notNull().references(() => alerts.id),
  recipientId: integer("recipient_id").notNull().references(() => users.id),
  status: text("status").notNull(),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const gateDecisions = pgTable("gate_decisions", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => enrollments.id),
  gateId: integer("gate_id").notNull().references(() => gates.id),
  outcome: outcomeEnum("outcome").notNull(),
  decidedBy: integer("decided_by").notNull().references(() => users.id),
  rationale: text("rationale").notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recoveryPlans = pgTable("recovery_plans", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => enrollments.id),
  gateDecisionId: integer("gate_decision_id").references(() => gateDecisions.id),
  plan: text("plan").notNull(),
  extensionDays: integer("extension_days").notNull().default(30),
});

export const sfSnapshots = pgTable("sf_snapshots", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => enrollments.id),
  kind: text("kind").notNull(), // inherited_book | progress
  payload: jsonb("payload").notNull(),
  takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sfCallLog = pgTable("sf_call_log", {
  id: serial("id").primaryKey(),
  tool: text("tool").notNull(),
  query: text("query"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  resultSize: integer("result_size"),
  success: boolean("success").notNull(),
  blocked: boolean("blocked").notNull().default(false),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actorId: integer("actor_id"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  before: jsonb("before"),
  after: jsonb("after"),
});
