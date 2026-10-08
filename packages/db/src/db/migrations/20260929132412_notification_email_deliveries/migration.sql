CREATE TABLE "notification_email_deliveries" (
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" text NOT NULL,
	"provider_message_id" text,
	"recipient_user_id" text NOT NULL,
	"type" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_email_deliveries_event_type_recipient_unique" ON "notification_email_deliveries" ("event_id","type","recipient_user_id");--> statement-breakpoint
CREATE INDEX "notification_email_deliveries_organization_idx" ON "notification_email_deliveries" ("organization_id");--> statement-breakpoint
ALTER TABLE "notification_email_deliveries" ADD CONSTRAINT "notification_email_deliveries_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_email_deliveries" ADD CONSTRAINT "notification_email_deliveries_ZLeRvJNggoXA_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_email_deliveries" ADD CONSTRAINT "notification_email_deliveries_recipient_user_id_users_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE;