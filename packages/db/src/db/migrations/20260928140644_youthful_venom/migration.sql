CREATE TYPE "file_access" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "file_kind" AS ENUM('document', 'image', 'text', 'audio', 'video', 'other');--> statement-breakpoint
CREATE TYPE "file_rag_status" AS ENUM('none', 'pending', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "file_source_type" AS ENUM('upload', 'text', 'url');--> statement-breakpoint
CREATE TYPE "oauth_connection_status" AS ENUM('connected', 'disconnected', 'error', 'expired');--> statement-breakpoint
CREATE TYPE "oauth_provider" AS ENUM('gmail', 'google_calendar');--> statement-breakpoint
CREATE TABLE "accounts" (
	"access_token" text,
	"access_token_expires_at" timestamp with time zone,
	"account_id" text NOT NULL,
	"id" text PRIMARY KEY,
	"id_token" text,
	"issuer" text,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apikeys" (
	"config_id" text DEFAULT 'default' NOT NULL,
	"enabled" boolean DEFAULT true,
	"expires_at" timestamp with time zone,
	"id" text PRIMARY KEY,
	"key" text NOT NULL,
	"last_refill_at" timestamp with time zone,
	"last_request" timestamp with time zone,
	"metadata" text,
	"name" text,
	"permissions" text,
	"prefix" text,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_max" integer DEFAULT 10,
	"rate_limit_time_window" integer DEFAULT 86400000,
	"reference_id" text NOT NULL,
	"refill_amount" integer,
	"refill_interval" integer,
	"remaining" integer,
	"request_count" integer DEFAULT 0,
	"start" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY,
	"inviter_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jwks" (
	"alg" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"crv" text,
	"expires_at" timestamp with time zone,
	"id" text PRIMARY KEY,
	"private_key" text NOT NULL,
	"public_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_access_tokens" (
	"authorization_code_id" text,
	"client_id" text NOT NULL,
	"confirmation" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY,
	"reference_id" text,
	"refresh_id" text,
	"requested_user_info_claims" text[],
	"resources" text[],
	"revoked" timestamp with time zone,
	"scopes" text[] NOT NULL,
	"session_id" text,
	"token" text NOT NULL UNIQUE,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "oauth_client_assertions" (
	"expires_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "oauth_client_resources" (
	"client_id" text NOT NULL,
	"created_at" timestamp with time zone,
	"id" text PRIMARY KEY,
	"metadata" jsonb,
	"resource_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"application_type" text,
	"backchannel_logout_session_required" boolean,
	"backchannel_logout_uri" text,
	"client_credentials_scopes" text[] DEFAULT '{}'::text[],
	"client_discovery_id" text,
	"client_id" text NOT NULL UNIQUE,
	"client_secret" text,
	"contacts" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled" boolean DEFAULT false,
	"dpop_bound_access_tokens" boolean DEFAULT false,
	"enable_end_session" boolean,
	"grant_types" text[],
	"icon" text,
	"id" text PRIMARY KEY,
	"jwks" text,
	"jwks_uri" text,
	"metadata" jsonb,
	"name" text,
	"policy" text,
	"post_logout_redirect_uris" text[],
	"redirect_uris" text[] NOT NULL,
	"reference_id" text,
	"require_pkce" boolean,
	"response_types" text[],
	"scopes" text[],
	"skip_consent" boolean,
	"software_id" text,
	"software_statement" text,
	"software_version" text,
	"subject_type" text,
	"token_endpoint_auth_method" text,
	"tos" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uri" text,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "oauth_consents" (
	"client_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"reference_id" text,
	"requested_user_info_claims" text[],
	"resources" text[],
	"scopes" text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "oauth_refresh_tokens" (
	"authorization_code_id" text,
	"auth_time" timestamp with time zone,
	"client_id" text NOT NULL,
	"confirmation" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY,
	"reference_id" text,
	"requested_user_info_claims" text[],
	"resources" text[],
	"revoked" timestamp with time zone,
	"rotated_at" timestamp with time zone,
	"rotation_replay_expires_at" timestamp with time zone,
	"rotation_replay_response" text,
	"scopes" text[] NOT NULL,
	"session_id" text,
	"token" text NOT NULL UNIQUE,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_resources" (
	"access_token_ttl" integer,
	"allowed_scopes" text[],
	"created_at" timestamp with time zone,
	"custom_claims" jsonb,
	"disabled" boolean DEFAULT false,
	"dpop_bound_access_tokens_required" boolean DEFAULT false,
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL UNIQUE,
	"metadata" jsonb,
	"name" text NOT NULL,
	"policy_version" integer DEFAULT 1,
	"refresh_token_ttl" integer,
	"signing_algorithm" text,
	"signing_key_id" text,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY,
	"logo" text,
	"metadata" text,
	"name" text NOT NULL,
	"slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"active_organization_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY,
	"ip_address" text,
	"token" text NOT NULL UNIQUE,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "two_factors" (
	"backup_codes" text NOT NULL,
	"failed_verification_count" integer DEFAULT 0,
	"id" text PRIMARY KEY,
	"locked_until" timestamp with time zone,
	"secret" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "users" (
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY,
	"image" text,
	"name" text NOT NULL,
	"two_factor_enabled" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"expires_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"document" jsonb NOT NULL,
	"first_published_at" timestamp with time zone,
	"generation_error" text,
	"generation_run_id" text,
	"generation_status" text DEFAULT 'idle' NOT NULL,
	"generation_token" uuid,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" text NOT NULL,
	"published_at" timestamp with time zone,
	"published_document" jsonb,
	"published_revision" integer,
	"published_updated_at" timestamp with time zone,
	"revision" integer DEFAULT 1 NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"contact_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"message" text NOT NULL,
	"section_id" uuid NOT NULL,
	"sender_name" text NOT NULL,
	"sender_phone" text,
	"spam_flag" boolean DEFAULT false NOT NULL,
	"triage_category" text,
	"triaged_at" timestamp with time zone,
	"triage_urgency" text,
	"website_id" uuid
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"email" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text,
	"organization_id" text NOT NULL,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fts" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, COALESCE("contacts"."name", '') || ' ' || COALESCE(translate("contacts"."email", '@.', '  '), '') || ' ' || COALESCE(translate("contacts"."phone", '+-().', '     '), ''))) STORED NOT NULL,
	CONSTRAINT "contacts_identity_required" CHECK (coalesce(nullif(btrim("name"), ''), nullif(btrim("email"), ''), nullif(btrim("phone"), '')) is not null)
);
--> statement-breakpoint
CREATE TABLE "event_dispatches" (
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_id" uuid PRIMARY KEY,
	"expanded_at" timestamp with time zone,
	"last_error_code" text,
	"organization_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_executions" (
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"consumer_key" text NOT NULL,
	"consumer_kind" text NOT NULL,
	"event_id" uuid NOT NULL,
	"expected_by" timestamp with time zone,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"next_attempt_at" timestamp with time zone,
	"organization_id" text NOT NULL,
	"outcome_code" text,
	"start_requested_at" timestamp with time zone,
	"state" text DEFAULT 'queued' NOT NULL,
	"workflow_run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"actor" jsonb NOT NULL,
	"causation_id" uuid,
	"correlation_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"id" uuid PRIMARY KEY,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" text NOT NULL,
	"producer_key" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"root_event_id" uuid NOT NULL,
	"source" text NOT NULL,
	"subject_id" text NOT NULL,
	"subject_revision" text,
	"subject_type" text NOT NULL,
	"type" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"access" "file_access" DEFAULT 'public'::"file_access" NOT NULL,
	"content_hash" varchar(64),
	"content_type" text NOT NULL,
	"doc_date" date,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ingest_run_id" text,
	"kind" "file_kind" DEFAULT 'other'::"file_kind" NOT NULL,
	"language" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"processing_error" text,
	"rag_status" "file_rag_status" DEFAULT 'none'::"file_rag_status" NOT NULL,
	"size_bytes" bigint,
	"source_type" "file_source_type" DEFAULT 'upload'::"file_source_type" NOT NULL,
	"summary" text,
	"title" text,
	"uploaded_by" text,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"fts" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((COALESCE("files"."title", '') || ' ' || COALESCE("files"."name", '')) || ' ' || COALESCE("files"."summary", '')))) STORED NOT NULL,
	CONSTRAINT "files_id_organization_id_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "file_tag_assignments" (
	"file_id" uuid,
	"organization_id" text NOT NULL,
	"tag_id" uuid,
	CONSTRAINT "file_tag_assignments_pkey" PRIMARY KEY("file_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "file_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_tags_org_slug_idx" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "oauth_connections" (
	"access_token" text NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"external_id" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"last_accessed_at" timestamp with time zone,
	"name" text,
	"organization_id" text NOT NULL,
	"picture" text,
	"provider" "oauth_provider" NOT NULL,
	"refresh_token" text NOT NULL,
	"scopes" text[],
	"status" "oauth_connection_status" DEFAULT 'connected'::"oauth_connection_status" NOT NULL,
	"synced_at" timestamp with time zone,
	"sync_token" text,
	"user_id" text,
	"watch_expiration" timestamp with time zone,
	"watch_id" text,
	"watch_resource_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_pages" (
	"document" jsonb NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" text NOT NULL,
	"published_at" timestamp with time zone,
	"published_brand" jsonb,
	"published_document" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_inboxes" (
	"last_sequence" bigint DEFAULT 0 NOT NULL,
	"organization_id" text,
	"user_id" text,
	CONSTRAINT "notification_inboxes_pkey" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"channel" text,
	"enabled" boolean NOT NULL,
	"organization_id" text,
	"type" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	CONSTRAINT "notification_preferences_pkey" PRIMARY KEY("organization_id","user_id","type","channel")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_id" uuid NOT NULL,
	"group_key" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" text NOT NULL,
	"params" jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"recipient_user_id" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"seen_at" timestamp with time zone,
	"sequence" bigint NOT NULL,
	"subject_id" text NOT NULL,
	"subject_type" text NOT NULL,
	"type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_answer_runs" (
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"mode" text NOT NULL,
	"organization_id" text NOT NULL,
	"question_id" uuid NOT NULL,
	"result" jsonb NOT NULL,
	"website_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"locale" text NOT NULL,
	"organization_id" text NOT NULL,
	"question" text NOT NULL,
	"source" text NOT NULL,
	"website_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_registrations" (
	"auto_renew" boolean DEFAULT true NOT NULL,
	"domain" text NOT NULL UNIQUE,
	"expires_at" timestamp with time zone,
	"failure_code" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" text,
	"organization_id" text,
	"provider" text DEFAULT 'vercel' NOT NULL,
	"purchase_price" numeric NOT NULL,
	"registered_at" timestamp with time zone,
	"registrant" jsonb NOT NULL,
	"reminder_days" integer,
	"renewal_price" numeric NOT NULL,
	"status" text DEFAULT 'registering' NOT NULL,
	"website_id" uuid,
	"workflow_run_id" text,
	"years" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_domains" (
	"caa_blocked" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp with time zone,
	"conflicts" jsonb DEFAULT '[]' NOT NULL,
	"connected_at" timestamp with time zone,
	"dns_ready" boolean DEFAULT false NOT NULL,
	"hostname" text NOT NULL UNIQUE,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"method" text DEFAULT 'records' NOT NULL,
	"ownership_verified" boolean DEFAULT false NOT NULL,
	"primary" boolean DEFAULT false NOT NULL,
	"records" jsonb DEFAULT '[]' NOT NULL,
	"registration_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"tls_ready" boolean DEFAULT false NOT NULL,
	"verification_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_versions" (
	"asset_bindings" jsonb NOT NULL,
	"brand" jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"logic" jsonb DEFAULT '{}' NOT NULL,
	"published_at" timestamp with time zone,
	"structure" jsonb NOT NULL,
	"template_id" text NOT NULL,
	"version" integer NOT NULL,
	"website_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "websites" (
	"brief" jsonb NOT NULL,
	"draft_version_id" uuid,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"locale" text NOT NULL,
	"organization_id" text NOT NULL,
	"published_version_id" uuid,
	"subdomain" text UNIQUE,
	"translation_locale" text,
	"workflow_run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "accounts" ("user_id");--> statement-breakpoint
CREATE INDEX "apikey_config_id_idx" ON "apikeys" ("config_id");--> statement-breakpoint
CREATE INDEX "apikey_key_idx" ON "apikeys" ("key");--> statement-breakpoint
CREATE INDEX "apikey_reference_id_idx" ON "apikeys" ("reference_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitations" ("email");--> statement-breakpoint
CREATE INDEX "invitation_organization_id_idx" ON "invitations" ("organization_id");--> statement-breakpoint
CREATE INDEX "member_user_id_idx" ON "members" ("user_id");--> statement-breakpoint
CREATE INDEX "member_organization_id_idx" ON "members" ("organization_id");--> statement-breakpoint
CREATE INDEX "oauth_access_token_client_id_idx" ON "oauth_access_tokens" ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_access_token_session_id_idx" ON "oauth_access_tokens" ("session_id");--> statement-breakpoint
CREATE INDEX "oauth_access_token_user_id_idx" ON "oauth_access_tokens" ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_access_token_refresh_id_idx" ON "oauth_access_tokens" ("refresh_id");--> statement-breakpoint
CREATE INDEX "oauth_access_token_reference_id_idx" ON "oauth_access_tokens" ("reference_id");--> statement-breakpoint
CREATE INDEX "oauth_access_token_authorization_code_id_idx" ON "oauth_access_tokens" ("authorization_code_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_client_resource_client_id_resource_id_uidx" ON "oauth_client_resources" ("client_id","resource_id");--> statement-breakpoint
CREATE INDEX "oauth_client_resource_client_id_idx" ON "oauth_client_resources" ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_client_resource_resource_id_idx" ON "oauth_client_resources" ("resource_id");--> statement-breakpoint
CREATE INDEX "oauth_client_user_id_idx" ON "oauth_clients" ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_client_reference_id_idx" ON "oauth_clients" ("reference_id");--> statement-breakpoint
CREATE INDEX "oauth_consent_client_id_idx" ON "oauth_consents" ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_consent_user_id_idx" ON "oauth_consents" ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_consent_reference_id_idx" ON "oauth_consents" ("reference_id");--> statement-breakpoint
CREATE INDEX "oauth_refresh_token_client_id_idx" ON "oauth_refresh_tokens" ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_refresh_token_session_id_idx" ON "oauth_refresh_tokens" ("session_id");--> statement-breakpoint
CREATE INDEX "oauth_refresh_token_user_id_idx" ON "oauth_refresh_tokens" ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_refresh_token_reference_id_idx" ON "oauth_refresh_tokens" ("reference_id");--> statement-breakpoint
CREATE INDEX "oauth_refresh_token_authorization_code_id_idx" ON "oauth_refresh_tokens" ("authorization_code_id");--> statement-breakpoint
CREATE INDEX "organization_slug_idx" ON "organizations" ("slug");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "session_token_idx" ON "sessions" ("token");--> statement-breakpoint
CREATE INDEX "two_factors_secret_idx" ON "two_factors" ("secret");--> statement-breakpoint
CREATE INDEX "two_factors_user_id_idx" ON "two_factors" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verifications" ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_organization_slug_unique" ON "blog_posts" ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "blog_posts_organization_published_idx" ON "blog_posts" ("organization_id","published_at");--> statement-breakpoint
CREATE INDEX "contact_messages_contact_created_idx" ON "contact_messages" ("contact_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_org_email_unique" ON "contacts" ("organization_id",lower(btrim("email")));--> statement-breakpoint
CREATE INDEX "contacts_org_created_idx" ON "contacts" ("organization_id","created_at","id");--> statement-breakpoint
CREATE INDEX "contacts_fts_idx" ON "contacts" USING gin ("fts" tsvector_ops);--> statement-breakpoint
CREATE INDEX "event_dispatches_pending_idx" ON "event_dispatches" ("available_at") WHERE "expanded_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "event_executions_event_consumer_unique" ON "event_executions" ("event_id","consumer_key");--> statement-breakpoint
CREATE INDEX "event_executions_open_idx" ON "event_executions" ("state","available_at") WHERE "state" in ('queued', 'running', 'retry_wait');--> statement-breakpoint
CREATE INDEX "event_executions_organization_kind_created_idx" ON "event_executions" ("organization_id","consumer_kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "events_organization_producer_key_unique" ON "events" ("organization_id","producer_key");--> statement-breakpoint
CREATE INDEX "events_organization_recorded_idx" ON "events" ("organization_id","recorded_at");--> statement-breakpoint
CREATE INDEX "events_organization_type_recorded_idx" ON "events" ("organization_id","type","recorded_at");--> statement-breakpoint
CREATE INDEX "events_organization_subject_recorded_idx" ON "events" ("organization_id","subject_type","subject_id","recorded_at");--> statement-breakpoint
CREATE INDEX "files_organization_id_idx" ON "files" ("organization_id");--> statement-breakpoint
CREATE INDEX "files_org_rag_status_idx" ON "files" ("organization_id","rag_status");--> statement-breakpoint
CREATE INDEX "files_org_created_at_idx" ON "files" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "files_content_hash_idx" ON "files" ("content_hash");--> statement-breakpoint
CREATE INDEX "files_url_idx" ON "files" ("url");--> statement-breakpoint
CREATE INDEX "files_fts_idx" ON "files" USING gin ("fts" tsvector_ops);--> statement-breakpoint
CREATE INDEX "file_tag_assignments_tag_id_idx" ON "file_tag_assignments" ("tag_id");--> statement-breakpoint
CREATE INDEX "file_tag_assignments_organization_id_idx" ON "file_tag_assignments" ("organization_id");--> statement-breakpoint
CREATE INDEX "file_tags_organization_id_idx" ON "file_tags" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_connection_org_level_unique" ON "oauth_connections" ("external_id","provider","organization_id") WHERE "user_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_connection_user_level_unique" ON "oauth_connections" ("external_id","provider","organization_id","user_id") WHERE "user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "oauth_connection_user_id_idx" ON "oauth_connections" ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_connection_org_id_idx" ON "oauth_connections" ("organization_id");--> statement-breakpoint
CREATE INDEX "oauth_connection_watch_expiration_idx" ON "oauth_connections" ("watch_expiration");--> statement-breakpoint
CREATE UNIQUE INDEX "link_pages_organization_id_unique" ON "link_pages" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_event_type_recipient_unique" ON "notifications" ("event_id","type","recipient_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_recipient_sequence_unique" ON "notifications" ("organization_id","recipient_user_id","sequence");--> statement-breakpoint
CREATE INDEX "notifications_unseen_idx" ON "notifications" ("organization_id","recipient_user_id") WHERE "seen_at" is null and "archived_at" is null;--> statement-breakpoint
CREATE INDEX "notifications_group_idx" ON "notifications" ("organization_id","type","group_key");--> statement-breakpoint
CREATE INDEX "seo_answer_runs_question_checked_idx" ON "seo_answer_runs" ("question_id","checked_at");--> statement-breakpoint
CREATE INDEX "seo_answer_runs_organization_idx" ON "seo_answer_runs" ("organization_id","website_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_questions_unique" ON "seo_questions" ("organization_id","website_id","locale","question");--> statement-breakpoint
CREATE INDEX "seo_questions_organization_idx" ON "seo_questions" ("organization_id","website_id","locale");--> statement-breakpoint
CREATE INDEX "domain_registrations_organization_idx" ON "domain_registrations" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "website_domains_primary_unique" ON "website_domains" ("website_id") WHERE "primary" = true;--> statement-breakpoint
CREATE INDEX "website_domains_pending_idx" ON "website_domains" ("checked_at") WHERE "status" <> 'connected';--> statement-breakpoint
CREATE UNIQUE INDEX "website_versions_website_id_id_unique" ON "website_versions" ("website_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "website_versions_website_id_version_unique" ON "website_versions" ("website_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "websites_organization_id_unique" ON "websites" ("organization_id");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_id_users_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_client_id_oauth_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_refresh_id_oauth_refresh_tokens_id_fkey" FOREIGN KEY ("refresh_id") REFERENCES "oauth_refresh_tokens"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_session_id_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "oauth_client_resources" ADD CONSTRAINT "oauth_client_resources_client_id_oauth_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "oauth_client_resources" ADD CONSTRAINT "oauth_client_resources_CxFm94nYigrM_fkey" FOREIGN KEY ("resource_id") REFERENCES "oauth_resources"("identifier") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_client_id_oauth_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_client_id_oauth_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_session_id_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_website_id_websites_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_dispatches" ADD CONSTRAINT "event_dispatches_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_dispatches" ADD CONSTRAINT "event_dispatches_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_executions" ADD CONSTRAINT "event_executions_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_executions" ADD CONSTRAINT "event_executions_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "file_tag_assignments" ADD CONSTRAINT "file_tag_assignments_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "file_tag_assignments" ADD CONSTRAINT "file_tag_assignments_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "file_tag_assignments" ADD CONSTRAINT "file_tag_assignments_tag_id_file_tags_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "file_tags"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "file_tags" ADD CONSTRAINT "file_tags_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "oauth_connections" ADD CONSTRAINT "oauth_connections_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "oauth_connections" ADD CONSTRAINT "oauth_connections_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "link_pages" ADD CONSTRAINT "link_pages_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_inboxes" ADD CONSTRAINT "notification_inboxes_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_inboxes" ADD CONSTRAINT "notification_inboxes_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "seo_answer_runs" ADD CONSTRAINT "seo_answer_runs_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "seo_answer_runs" ADD CONSTRAINT "seo_answer_runs_question_id_seo_questions_id_fkey" FOREIGN KEY ("question_id") REFERENCES "seo_questions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "seo_answer_runs" ADD CONSTRAINT "seo_answer_runs_website_id_websites_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "seo_questions" ADD CONSTRAINT "seo_questions_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "seo_questions" ADD CONSTRAINT "seo_questions_website_id_websites_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "domain_registrations" ADD CONSTRAINT "domain_registrations_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "domain_registrations" ADD CONSTRAINT "domain_registrations_website_id_websites_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "website_domains" ADD CONSTRAINT "website_domains_registration_id_domain_registrations_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "domain_registrations"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "website_domains" ADD CONSTRAINT "website_domains_website_id_websites_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "website_versions" ADD CONSTRAINT "website_versions_website_id_websites_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "websites" ADD CONSTRAINT "websites_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "websites" ADD CONSTRAINT "websites_draft_version_owner_fkey" FOREIGN KEY ("id","draft_version_id") REFERENCES "website_versions"("website_id","id");--> statement-breakpoint
ALTER TABLE "websites" ADD CONSTRAINT "websites_published_version_owner_fkey" FOREIGN KEY ("id","published_version_id") REFERENCES "website_versions"("website_id","id");