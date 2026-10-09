DROP INDEX "files_url_idx";--> statement-breakpoint
DROP INDEX "files_org_url_unique";--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN "url";--> statement-breakpoint
CREATE UNIQUE INDEX "files_org_storage_key_unique" ON "files" ("organization_id","storage_key") WHERE "storage_key" is not null and "deleted_at" is null;