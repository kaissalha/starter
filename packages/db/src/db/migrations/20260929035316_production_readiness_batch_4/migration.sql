CREATE TABLE "terms_acceptances" (
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"version" text,
	CONSTRAINT "terms_acceptances_pkey" PRIMARY KEY("user_id","version")
);
--> statement-breakpoint
DROP INDEX "events_organization_recorded_idx";--> statement-breakpoint
DROP INDEX "events_organization_type_recorded_idx";--> statement-breakpoint
DROP INDEX "events_organization_subject_recorded_idx";--> statement-breakpoint
CREATE INDEX "events_recorded_idx" ON "events" ("recorded_at");--> statement-breakpoint
ALTER TABLE "terms_acceptances" ADD CONSTRAINT "terms_acceptances_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;