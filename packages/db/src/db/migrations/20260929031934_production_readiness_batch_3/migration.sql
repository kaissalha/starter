CREATE TABLE "organization_purges" (
	"attempts" integer DEFAULT 0 NOT NULL,
	"blobs" jsonb DEFAULT '[]' NOT NULL,
	"completed_at" timestamp with time zone,
	"hostnames" jsonb DEFAULT '[]' NOT NULL,
	"last_error" text,
	"organization_id" text PRIMARY KEY,
	"registration_domains" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_subdomain_history" (
	"released_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subdomain" text PRIMARY KEY,
	"website_id" uuid
);
--> statement-breakpoint
ALTER TABLE "website_domains" DROP CONSTRAINT "website_domains_hostname_key";--> statement-breakpoint
CREATE INDEX "contact_messages_website_idx" ON "contact_messages" ("website_id");--> statement-breakpoint
CREATE INDEX "event_dispatches_organization_idx" ON "event_dispatches" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_org_url_unique" ON "files" ("organization_id","url") WHERE "url" is not null and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "organization_purges_pending_idx" ON "organization_purges" ("updated_at") WHERE "completed_at" is null;--> statement-breakpoint
CREATE INDEX "seo_answer_runs_website_idx" ON "seo_answer_runs" ("website_id");--> statement-breakpoint
CREATE INDEX "seo_questions_website_idx" ON "seo_questions" ("website_id");--> statement-breakpoint
CREATE INDEX "domain_registrations_website_idx" ON "domain_registrations" ("website_id");--> statement-breakpoint
CREATE UNIQUE INDEX "website_domains_verified_hostname_unique" ON "website_domains" ("hostname") WHERE "ownership_verified" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "website_domains_website_hostname_unique" ON "website_domains" ("website_id","hostname");--> statement-breakpoint
CREATE INDEX "website_domains_hostname_idx" ON "website_domains" ("hostname");--> statement-breakpoint
CREATE INDEX "website_domains_website_idx" ON "website_domains" ("website_id");--> statement-breakpoint
CREATE INDEX "website_domains_registration_idx" ON "website_domains" ("registration_id");--> statement-breakpoint
ALTER TABLE "website_subdomain_history" ADD CONSTRAINT "website_subdomain_history_website_id_websites_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE SET NULL;