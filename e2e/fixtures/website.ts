import {
	entityIdFromSeed,
	instantiateTemplate,
	instantiateSection,
	parseSiteDocument,
} from "@starter/infinite-website";
import {
	editWebsiteSnapshots,
	prepareWebsiteEditInputs,
	type WebsiteEditInput,
} from "@starter/infinite-website/editing";
import {
	createGenerationTemplateBrand,
	websiteGenerationProfiles,
	websiteGenerationSectionDefinitions,
	type PersistedWebsiteSiteV1,
} from "@starter/infinite-website/generation";
import { nordicEdgeTemplate } from "@starter/infinite-website/templates/nordic-edge";
import content from "@starter/infinite-website/templates/nordic-edge/content" with { type: "json" };

const email = "playwright@example.com";

const workflowRunId = "playwright-website-generation";

export const publicWebsiteOrganizationId = "playwright-public-website";

export const publicWebsiteId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339";

export const generatedWebsiteBrief = {
	location: "Vancouver, Canada",
	name: "Northstar Studio",
	schemaVersion: 1,
	type: "Interior design studio",
} as const;

const createGeneratedSite = () => {
	const profile = websiteGenerationProfiles.find(({ templateId }) => templateId === nordicEdgeTemplate.id);

	if (!profile) {
		throw new Error("Nordic Edge generation profile is missing");
	}

	return {
		assetBindings: {},
		brand: createGenerationTemplateBrand({
			locale: "en",
			profile,
		}),
		document: parseSiteDocument(
			instantiateTemplate({
				content,
				createId: ({ kind, path }) => entityIdFromSeed({ seed: `playwright:${kind}:${path}` }),
				definition: nordicEdgeTemplate,
				path: "/website",
			})
		),
		schemaVersion: 1,
		templateId: nordicEdgeTemplate.id,
	} satisfies PersistedWebsiteSiteV1;
};

const framePadding = {
	blockEnd: "4rem",
	blockStart: "4rem",
	inlineEnd: "1.5rem",
	inlineStart: "1.5rem",
} as const;

// oxlint-disable-next-line eslint/max-lines-per-function -- The persisted browser fixture keeps both complete section graphs together so their cross-section scroll target stays explicit.
const createPublicSite = async () => {
	const site = createGeneratedSite();
	const page = site.document.structure.pages[0];
	const target = page?.sections.find((section) => section.anchor === "banner-card-and-background-image");

	if (!page || !target) {
		throw new Error("Public website fixture has no interaction target");
	}

	const edits = [
		{
			index: 0,
			operation: "add-composed-section",
			pageId: page.id,
			seed: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d360",
			specification: {
				content: {
					ar: {
						"amount-invalid": "أدخل رقمًا عشريًا صالحًا",
						"amount-label": "المبلغ الأساسي",
						"amount-placeholder": "٠٫١",
						description: "تُحسب النتيجة بدقة باستخدام تعبير CEL.",
						heading: "حاسبة CEL",
						"result-label": "الإجمالي",
						"result-unavailable": "غير متاح",
						"tax-invalid": "أدخل رقمًا عشريًا صالحًا",
						"tax-label": "الضريبة",
						"tax-placeholder": "٠٫٢",
					},
					en: {
						"amount-invalid": "Enter a valid decimal",
						"amount-label": "Base amount",
						"amount-placeholder": "0.1",
						description: "The result is calculated exactly with a CEL expression.",
						heading: "CEL calculator",
						"result-label": "Exact total",
						"result-unavailable": "Unavailable",
						"tax-invalid": "Enter a valid decimal",
						"tax-label": "Tax",
						"tax-placeholder": "0.2",
					},
				},
				logic: {
					expression: "amount + tax",
					fields: [
						{ initial: "0.1", key: "amount" },
						{ initial: "0.2", key: "tax" },
					],
					kind: "expression",
				},
				structure: {
					nodes: [
						{
							children: ["cel-frame"],
							key: "cel-surface",
							props: { fill: "tint", padding: framePadding },
							type: "box",
						},
						{
							children: ["cel-intro", "cel-controls"],
							key: "cel-frame",
							props: {
								columns: { base: 1, medium: 2 },
								gap: "2rem",
								inlineSize: "full",
								margin: { inlineEnd: "auto", inlineStart: "auto" },
								maxInlineSize: "96rem",
							},
							type: "grid",
						},
						{
							children: ["cel-heading", "cel-description"],
							key: "cel-intro",
							props: { direction: "column", gap: "1rem" },
							type: "flex",
						},
						{
							children: [],
							key: "cel-heading",
							props: { content: "heading", element: "h2" },
							type: "text",
						},
						{
							children: [],
							key: "cel-description",
							props: { content: "description", element: "p" },
							type: "text",
						},
						{
							children: ["amount-field", "tax-field", "result-value"],
							key: "cel-controls",
							props: { direction: "column", gap: "1rem" },
							type: "flex",
						},
						{
							children: ["amount-label"],
							key: "amount-field",
							props: {
								invalid: "amount-invalid",
								placeholder: "amount-placeholder",
								slot: "amount",
							},
							type: "field",
						},
						{
							children: [],
							key: "amount-label",
							props: { content: "amount-label", element: "span" },
							type: "text",
						},
						{
							children: ["tax-label"],
							key: "tax-field",
							props: {
								invalid: "tax-invalid",
								placeholder: "tax-placeholder",
								slot: "tax",
							},
							type: "field",
						},
						{
							children: [],
							key: "tax-label",
							props: { content: "tax-label", element: "span" },
							type: "text",
						},
						{
							children: ["result-label"],
							key: "result-value",
							props: {
								format: { maximumFractionDigits: 2, style: "decimal" },
								output: "result",
								unavailable: "result-unavailable",
							},
							type: "value",
						},
						{
							children: [],
							key: "result-label",
							props: { content: "result-label", element: "span" },
							type: "text",
						},
					],
					root: "cel-surface",
				},
			},
		},
		{
			index: 1,
			operation: "add-composed-section",
			pageId: page.id,
			seed: "028ff7c2-1f7c-7b28-b6c1-3f2e60b5d361",
			specification: {
				content: {
					ar: {
						"count-invalid": "أدخل رقمًا عشريًا صالحًا",
						"count-label": "العدد",
						"count-placeholder": "٣",
						"doubled-label": "الضعف",
						"doubled-unavailable": "غير متاح",
						heading: "حاسبة QuickJS",
						"result-label": "القيمة",
						"result-unavailable": "غير متاح",
						"trigger-label": "انتقل إلى التفاصيل",
						"trigger-text": "عرض التفاصيل",
					},
					en: {
						"count-invalid": "Enter a valid decimal",
						"count-label": "Count",
						"count-placeholder": "3",
						"doubled-label": "Doubled",
						"doubled-unavailable": "Unavailable",
						heading: "QuickJS calculator",
						"result-label": "Value",
						"result-unavailable": "Unavailable",
						"trigger-label": "Jump to details",
						"trigger-text": "View details",
					},
				},
				logic: {
					events: ["details_click"],
					fields: [{ initial: "3", key: "count" }],
					kind: "script",
					outputs: ["result", "doubled"],
					script: `function calculate(inputs) {
	return { result: Number(inputs.count), doubled: Number(inputs.count) * 2 };
}
function interact(event) {
	return event === "details_click" ? { type: "scroll-to", anchor: ${JSON.stringify(target.anchor)} } : null;
}`,
				},
				structure: {
					nodes: [
						{
							children: ["script-frame"],
							key: "script-surface",
							props: { fill: "canvas", padding: framePadding },
							type: "box",
						},
						{
							children: [
								"script-heading",
								"count-field",
								"script-result-value",
								"doubled-value",
								"details-trigger",
							],
							key: "script-frame",
							props: {
								direction: "column",
								gap: "1rem",
								inlineSize: "full",
								margin: { inlineEnd: "auto", inlineStart: "auto" },
								maxInlineSize: "96rem",
							},
							type: "flex",
						},
						{
							children: [],
							key: "script-heading",
							props: { content: "heading", element: "h2" },
							type: "text",
						},
						{
							children: ["count-label"],
							key: "count-field",
							props: {
								invalid: "count-invalid",
								placeholder: "count-placeholder",
								slot: "count",
							},
							type: "field",
						},
						{
							children: [],
							key: "count-label",
							props: { content: "count-label", element: "span" },
							type: "text",
						},
						{
							children: ["script-result-label"],
							key: "script-result-value",
							props: {
								format: { maximumFractionDigits: 0, style: "decimal" },
								output: "result",
								unavailable: "result-unavailable",
							},
							type: "value",
						},
						{
							children: [],
							key: "script-result-label",
							props: { content: "result-label", element: "span" },
							type: "text",
						},
						{
							children: ["doubled-label"],
							key: "doubled-value",
							props: {
								format: { maximumFractionDigits: 0, style: "decimal" },
								output: "doubled",
								unavailable: "doubled-unavailable",
							},
							type: "value",
						},
						{
							children: [],
							key: "doubled-label",
							props: { content: "doubled-label", element: "span" },
							type: "text",
						},
						{
							children: ["trigger-text"],
							key: "details-trigger",
							props: { event: "details_click", label: "trigger-label" },
							type: "trigger",
						},
						{
							children: [],
							key: "trigger-text",
							props: { content: "trigger-text", element: "span" },
							type: "text",
						},
					],
					root: "script-surface",
				},
			},
		},
	] satisfies Array<WebsiteEditInput>;

	const prepared = await prepareWebsiteEditInputs(edits);
	const edited = editWebsiteSnapshots({ inputs: prepared, snapshot: site });
	const definition = websiteGenerationSectionDefinitions.find(({ pattern }) => pattern === "blog-latest-three");
	const home = edited.document.structure.pages.find((candidate) => candidate.home);

	if (!definition || !home) {
		throw new Error("Blog feed fixture is unavailable");
	}

	const feed = instantiateSection({
		anchor: "latest-posts",
		content: {
			ar: { copy: { empty: "Publish a post", heading: "Latest posts" } },
			en: { copy: { empty: "Publish a post", heading: "Latest posts" } },
		},
		createId: ({ kind, path }) => entityIdFromSeed({ seed: `blog-feed:${kind}:${path}` }),
		defaultLocale: "en",
		definition,
		path: "/feed",
	});

	home.sections.push(feed.section);

	for (const locale of ["en", "ar"] as const) {
		const localized = edited.document.content[locale];
		const copy = feed.content[locale];

		if (!localized || !copy) {
			throw new Error("Missing blog feed locale");
		}

		localized.sections[feed.section.contentId] = copy;
	}

	return { ...edited, document: parseSiteDocument(edited.document) } satisfies PersistedWebsiteSiteV1;
};

export const seedPublicWebsite = async () => {
	const [{ eq }, database, persistence] = await Promise.all([
		import("drizzle-orm"),
		import("@starter/db"),
		import("../../packages/server/src/services/websites/persistence"),
	]);

	const organizationId = publicWebsiteOrganizationId;

	await database.db
		.insert(database.organizations)
		.values({ id: organizationId, name: "Public Website" })
		.onConflictDoNothing();

	await database.db
		.insert(database.websites)
		.values({
			brief: generatedWebsiteBrief,
			id: publicWebsiteId,
			locale: "en",
			organizationId,
		})
		.onConflictDoNothing();

	const [version] = await database.db
		.insert(database.websiteVersions)
		.values({
			version: 1,
			websiteId: publicWebsiteId,
			...persistence.splitPersistedWebsiteSite({ site: await createPublicSite() }),
			publishedAt: new Date().toISOString(),
		})
		.returning();

	if (!version) {
		throw new Error("Public website version was not created");
	}

	await database.db
		.update(database.websites)
		.set({ draftVersionId: version.id, publishedVersionId: version.id })
		.where(eq(database.websites.id, publicWebsiteId));
};

export const seedGeneratedWebsite = async () => {
	const [{ eq }, { db, members, users }, services] = await Promise.all([
		import("drizzle-orm"),
		import("@starter/db"),
		import("../../packages/server/src/services/websites/service"),
	]);

	const [membership] = await db
		.select({ organizationId: members.organizationId })
		.from(users)
		.innerJoin(members, eq(members.userId, users.id))
		.where(eq(users.email, email))
		.limit(1);

	if (!membership) {
		throw new Error("The Playwright user has no workspace membership");
	}

	const preparation = await services.prepareWebsiteGenerationStart({
		brief: generatedWebsiteBrief,
		organizationId: membership.organizationId,
	});

	await services.claimWebsiteWorkflowRun({
		brief: preparation.brief,
		expectedRunId: preparation.expectedRunId,
		kind: "generation",
		organizationId: membership.organizationId,
		runId: workflowRunId,
		websiteId: preparation.record.id,
	});

	const snapshot = await services.completeWebsiteWorkflow({
		organizationId: membership.organizationId,
		site: createGeneratedSite(),
		websiteId: preparation.record.id,
		workflowRunId,
	});

	if (!snapshot) {
		throw new Error("The generated website fixture was not persisted");
	}

	return { websiteId: preparation.record.id, workflowRunId };
};
