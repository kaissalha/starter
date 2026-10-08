ALTER TABLE "websites" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "suspension_reason" text;