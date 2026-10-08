import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organizations } from "../auth/organizations.ts";
import { timeFields } from "../helpers/time.ts";
import { websites } from "../websites/websites.ts";

export type SeoAnswerSnapshot = {
	brand: string;
	location: string;
	prompt: string;
	results: Array<
		| {
				brandMentioned: boolean;
				fetchedAt: string;
				model: "openai" | "gemini" | "claude";
				sources: Array<{ domain: string; title: string; url: string }>;
				status: "success";
				text: string;
		  }
		| { model: "openai" | "gemini" | "claude"; status: "error" }
	>;
};

export const seoQuestions = pgTable(
	"seo_questions",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		locale: text("locale", { enum: ["en", "ar"] }).notNull(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		question: text("question").notNull(),
		source: text("source", { enum: ["generated", "custom"] }).notNull(),
		websiteId: uuid("website_id")
			.notNull()
			.references(() => websites.id, { onDelete: "cascade" }),
		...timeFields,
	},
	(table) => [
		uniqueIndex("seo_questions_unique").on(table.organizationId, table.websiteId, table.locale, table.question),
		index("seo_questions_organization_idx").on(table.organizationId, table.websiteId, table.locale),
		index("seo_questions_website_idx").on(table.websiteId),
	]
);

export const seoAnswerRuns = pgTable(
	"seo_answer_runs",
	{
		checkedAt: timestamp("checked_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		mode: text("mode", { enum: ["sample", "web"] }).notNull(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		questionId: uuid("question_id")
			.notNull()
			.references(() => seoQuestions.id, { onDelete: "cascade" }),
		result: jsonb("result").notNull().$type<SeoAnswerSnapshot>(),
		websiteId: uuid("website_id")
			.notNull()
			.references(() => websites.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("seo_answer_runs_question_checked_idx").on(table.questionId, table.checkedAt),
		index("seo_answer_runs_organization_idx").on(table.organizationId, table.websiteId),
		index("seo_answer_runs_website_idx").on(table.websiteId),
	]
);
