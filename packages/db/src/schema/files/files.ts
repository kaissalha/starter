import { sql, type SQL } from "drizzle-orm";
import {
	bigint,
	date,
	index,
	jsonb,
	pgEnum,
	pgTable,
	text,
	unique,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { organizations } from "../auth/organizations.ts";
import { users } from "../auth/users.ts";
import { deletedFields } from "../helpers/deleted.ts";
import { timeFields } from "../helpers/time.ts";
import { tsvector } from "../helpers/tsvector.ts";

export const fileAccess = pgEnum("file_access", ["public", "private"]);

export const fileAccessValues = fileAccess.enumValues;

export const fileKind = pgEnum("file_kind", ["document", "image", "text", "audio", "video", "other"]);

export const fileKindValues = fileKind.enumValues;

export const fileSourceType = pgEnum("file_source_type", ["upload", "text", "url"]);

export const fileSourceTypeValues = fileSourceType.enumValues;

export const fileRagStatus = pgEnum("file_rag_status", ["none", "pending", "ready", "failed"]);

export const fileRagStatusValues = fileRagStatus.enumValues;

export type FileMetadata = {
	altText?: string;
	blurhash?: string;
	documentCategory?: "invoice" | "receipt" | "contract" | "proposal" | "report" | "reference" | "unknown";

	durationSec?: number;
	exif?: Record<string, boolean | null | number | string | Array<string>>;
	generation?: { model: string; prompt: string; sourceFileId?: string };
	height?: number;

	ocrText?: string;

	originalFilename?: string;

	pageCount?: number;
	sourceUrl?: string;
	stockImage?: { id: string; provider: string };
	thumbnailUrl?: string;

	width?: number;
	wordCount?: number;
};

export const files = pgTable(
	"files",
	{
		access: fileAccess("access").notNull().default("public"),
		content: text("content"),
		contentHash: varchar("content_hash", { length: 64 }),
		contentType: text("content_type").notNull(),

		docDate: date("doc_date"),
		id: uuid("id").primaryKey().defaultRandom().notNull(),
		ingestRunId: text("ingest_run_id"),
		kind: fileKind("kind").notNull().default("other"),
		language: text("language"),
		metadata: jsonb("metadata").notNull().$type<FileMetadata>().default({}),

		name: text("name").notNull(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		processingError: text("processing_error"),
		ragStatus: fileRagStatus("rag_status").notNull().default("none"),
		sizeBytes: bigint("size_bytes", { mode: "number" }),
		sourceType: fileSourceType("source_type").notNull().default("upload"),

		summary: text("summary"),
		title: text("title"),
		uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: "set null" }),

		url: text("url"),
		versionGroupId: uuid("version_group_id"),
		...timeFields,
		...deletedFields,

		fts: tsvector("fts")
			.notNull()
			.generatedAlwaysAs(
				(): SQL =>
					sql`to_tsvector('english'::regconfig, COALESCE(${files.title}, '') || ' ' || COALESCE(${files.name}, '') || ' ' || COALESCE(${files.summary}, '') || ' ' || COALESCE(${files.language}, '') || ' ' || COALESCE(${files.contentType}, '') || ' ' || COALESCE(${files.metadata}->>'altText', '') || ' ' || COALESCE(${files.metadata}->>'ocrText', '') || ' ' || COALESCE(${files.metadata}->>'documentCategory', '') || ' ' || COALESCE(${files.metadata}#>>'{generation,prompt}', '') || ' ' || COALESCE(${files.metadata}->>'originalFilename', '') || ' ' || COALESCE(${files.content}, ''))`
			),
	},
	(table) => [
		unique("files_id_organization_id_unique").on(table.id, table.organizationId),
		index("files_organization_id_idx").on(table.organizationId),
		index("files_org_rag_status_idx").on(table.organizationId, table.ragStatus),
		index("files_org_created_at_idx").on(table.organizationId, table.createdAt),
		index("files_org_version_group_idx").on(table.organizationId, table.versionGroupId),
		index("files_content_hash_idx").on(table.contentHash),
		index("files_url_idx").on(table.url),
		uniqueIndex("files_org_url_unique")
			.on(table.organizationId, table.url)
			.where(sql`${table.url} is not null and ${table.deletedAt} is null`),
		index("files_fts_idx").using("gin", table.fts.asc().nullsLast().op("tsvector_ops")),
	]
);

export type FileRecord = typeof files.$inferSelect;

export type NewFileRecord = typeof files.$inferInsert;

export type FileAccess = (typeof fileAccessValues)[number];

export type FileKind = (typeof fileKindValues)[number];

export type FileSourceType = (typeof fileSourceTypeValues)[number];

export type FileRagStatus = (typeof fileRagStatusValues)[number];
