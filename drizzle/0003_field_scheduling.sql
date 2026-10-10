ALTER TABLE "enrollments" ADD COLUMN "territory" text;--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "scheduled_for" date;--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "scheduled_by" integer;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_scheduled_by_users_id_fk" FOREIGN KEY ("scheduled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;