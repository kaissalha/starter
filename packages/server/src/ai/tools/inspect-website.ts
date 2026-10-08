import { createTool, type ToolObserve } from "@mastra/core/tools";
import { z } from "zod";

import type { LinkValue } from "@starter/infinite-website";
import { listSectionContentReferences } from "@starter/infinite-website/editing";
import {
	contentKeySchema,
	describeWebsiteThemeForAuthoring,
	diagnoseComposedSection,
	inspectComposedSection,
	inspectSectionLogic,
	listWebsitePageSectionLayouts,
	resolveLocalizedContent,
	resolveLocalizedPageSlug,
	stringValueSchema,
	summarizeSectionDesign,
} from "@starter/infinite-website/editing";
import {
	iso6391LanguageCodes,
	type SiteDocument,
	type WebsiteStateV1,
	websiteGenerationSectionCategories,
} from "@starter/infinite-website/generation";

import { requireOrganizationPermission } from "../../services/permissions";
import {
	findWebsiteSectionReference,
	listWebsiteSectionCatalog,
	recommendWebsiteSectionPattern,
} from "../../services/websites/section-catalog";
import { getWebsite } from "../../services/websites/service";
import { appContextSchema } from "../types";
import { websitePageHandleSchema, websiteSectionHandleSchema } from "../website-contracts";
import {
	listSectionCollections,
	listSectionTexts,
	listSectionLinks,
	listWebsitePageHandles,
	listWebsiteSectionHandles,
} from "../website-texts";

const textPageItemLimit = 400;

const textPageCharacterLimit = 40_000;

const previewCharacters = 160;

const paginateTexts = <Text extends { value: string }>(items: Array<Text>, offset = 0) => {
	const state = { characters: 0, page: Array<Text>() };

	for (const item of items.slice(offset, offset + textPageItemLimit)) {
		if (state.page.length > 0 && state.characters + item.value.length > textPageCharacterLimit) {
			break;
		}

		state.page.push(item);
		state.characters += item.value.length;
	}

	return {
		nextOffset: offset + state.page.length < items.length ? offset + state.page.length : null,
		page: state.page,
	};
};

type SectionHandle = ReturnType<typeof listWebsiteSectionHandles>[number];

const summarizeSection = ({
	document,
	handle: { index, section },
	handle,
	locale,
}: {
	document: SiteDocument;
	handle: SectionHandle;
	locale: SiteDocument["defaultLocale"];
}) => {
	const root = section.root;

	const contentFrame =
		root.type === "box"
			? (root.props.children.find((child) => child.layout !== undefined) ?? root.props.children[0])
			: undefined;

	return {
		anchor: section.anchor,
		category: section.category,
		composed: inspectComposedSection({ document, section }) !== null,
		hasLogic: inspectSectionLogic({ document, section }) !== null,
		index,
		outerFrame: {
			contentLayout: contentFrame?.layout ?? null,
			fill: root.type === "box" ? (root.props.fill ?? null) : null,
			rootLayout: root.layout ?? null,
		},
		pattern: section.source?.pattern ?? null,
		section: handle.handle,
		textPreview: listSectionTexts({ document, locale, section })
			.map(({ value }) => value.trim())
			.filter(Boolean)
			.slice(0, 3)
			.map((value) => value.slice(0, previewCharacters)),
	};
};

type Inspection = {
	base: {
		activeWorkflow: { kind: string; state: string } | null;
		locale: SiteDocument["defaultLocale"];
		publication: { hasUnpublishedChanges: boolean; publishedAt: string | null };
		revision: string;
	};
	document: SiteDocument;
	locale: SiteDocument["defaultLocale"];
	pageHandleById: Map<string, string>;
	pages: ReturnType<typeof listWebsitePageHandles>;
	sectionHandleById: Map<string, string>;
	sections: Array<SectionHandle>;
	snapshot: NonNullable<WebsiteStateV1["snapshot"]>;
};

const findPage = ({ pages }: Inspection, handle: string) => {
	const page = pages.find((candidate) => candidate.handle === handle)?.page;

	if (!page) {
		throw new Error("Website page not found");
	}

	return page;
};

const pageDetails = (
	{ document, locale }: Inspection,
	{ home, id: pageId }: SiteDocument["structure"]["pages"][number]
) => {
	const { content, defaultLocale } = document;
	const slug = resolveLocalizedPageSlug({ content, defaultLocale, locale, pageId });
	const basePath = locale === defaultLocale ? "" : `/${locale}`;

	return {
		path: home ? basePath || "/" : `${basePath}/${slug}`,
		slug,
		title: stringValueSchema.parse(
			resolveLocalizedContent({
				area: "pages",
				content,
				defaultLocale,
				id: pageId,
				locale,
				pointer: "/seo/title",
			})
		),
	};
};

const projectLink = ({ pageHandleById, sectionHandleById }: Inspection, value: LinkValue) => {
	if (value.kind === "page") {
		const page = pageHandleById.get(value.pageId);
		const section = value.sectionId ? sectionHandleById.get(value.sectionId) : undefined;

		if (!page || (value.sectionId && !section)) {
			throw new Error("Website link target not found");
		}

		return { kind: value.kind, page, section };
	}

	if (value.kind === "section") {
		const section = sectionHandleById.get(value.sectionId);

		if (!section) {
			throw new Error("Website link target not found");
		}

		return { kind: value.kind, section };
	}

	return value;
};

const withoutFrame = ({ outerFrame: _outerFrame, ...summary }: ReturnType<typeof summarizeSection>) => summary;

const summarize = ({ document, locale }: Inspection, candidates: Array<SectionHandle>) =>
	candidates.map((handle) => summarizeSection({ document, handle, locale }));

const inspectTexts = (inspection: Inspection, input: { contains?: string; offset?: number; page?: string }) => {
	const page = input.page ? findPage(inspection, input.page) : undefined;
	const needle = input.contains?.toLocaleLowerCase();

	const texts = inspection.sections
		.filter((candidate) => !page || candidate.pageId === page.id)
		.flatMap((candidate) =>
			listSectionTexts({
				document: inspection.document,
				locale: inspection.locale,
				section: candidate.section,
			}).flatMap(({ target, value }) =>
				needle && !value.toLocaleLowerCase().includes(needle)
					? []
					: [
							{
								area: candidate.area,
								page: candidate.pageId
									? (inspection.pageHandleById.get(candidate.pageId) ?? null)
									: null,
								section: candidate.handle,
								target,
								value,
							},
						]
			)
		);

	const textPage = paginateTexts(texts, input.offset);

	return {
		scope: "texts" as const,
		...inspection.base,
		nextOffset: textPage.nextOffset,
		texts: textPage.page,
		truncated: textPage.nextOffset !== null,
	};
};

const inspectReference = async (
	inspection: Inspection,
	{ index, page, recommend }: { index?: number; page?: string; recommend?: string },
	{ abortSignal }: { abortSignal?: AbortSignal }
) => {
	if (!page || index === undefined || !recommend) {
		throw new Error("Reference scope requires a page handle, an insertion index, and a request");
	}

	return {
		scope: "reference" as const,
		...inspection.base,
		index,
		page,
		...(await findWebsiteSectionReference({
			abortSignal,
			index,
			pageId: findPage(inspection, page).id,
			request: recommend,
			snapshot: inspection.snapshot,
		})),
	};
};

const inspectContext = (inspection: Inspection, { index, page }: { index?: number; page?: string }) => {
	if (!page || index === undefined) {
		throw new Error("Context scope requires a page handle and an insertion index");
	}

	const target = findPage(inspection, page);

	if (index > target.sections.length) {
		throw new Error("Website insertion index not found");
	}

	const neighbour = (offset: number) => {
		const section = target.sections[index + offset];

		return section
			? {
					section: inspection.sectionHandleById.get(section.id) ?? null,
					...summarizeSectionDesign(section),
				}
			: null;
	};

	return {
		scope: "context" as const,
		...inspection.base,
		index,
		neighbours: { after: neighbour(0), before: neighbour(-1) },
		note: "Neighbours are a window onto the page, not the whole page: match their rhythm and padding scale, but vary fill or layout so the page does not repeat. Use theme.surfaces as the only colors and textTones to pick tones that stay readable on each fill.",
		outline: target.sections.map((section, position) => {
			const { fill, pattern } = summarizeSectionDesign(section);

			return `${position}:${section.category}${pattern ? `/${pattern}` : ""}:${fill ?? "none"}`;
		}),
		page,
		theme: describeWebsiteThemeForAuthoring({ brand: inspection.snapshot.brand, locale: inspection.locale }),
	};
};

const inspectPage = (inspection: Inspection, handle: string) => {
	const page = findPage(inspection, handle);

	return {
		scope: "page" as const,
		...inspection.base,
		page: {
			handle,
			...pageDetails(inspection, page),
			addablePatterns: listWebsiteSectionCatalog({
				index: page.sections.length,
				pageId: page.id,
				snapshot: inspection.snapshot,
			})
				.slice(0, 12)
				.map(({ category, pattern }) => ({ category, pattern })),
			insertionIndexes: Array.from({ length: page.sections.length + 1 }, (_, index) => index),
			sections: summarize(
				inspection,
				inspection.sections.filter((candidate) => candidate.pageId === page.id)
			),
		},
	};
};

const inspectSection = async (
	inspection: Inspection,
	input: { copyKeys?: Array<string>; recommend?: string; section: string; textOffset?: number },
	context?: { abortSignal?: AbortSignal; observe?: ToolObserve }
) => {
	const { document, locale } = inspection;
	const target = inspection.sections.find((candidate) => candidate.handle === input.section);

	if (!target) {
		throw new Error("Website section not found");
	}

	const composed = inspectComposedSection({ document, section: target.section });
	const requestedCopyKeys = new Set(input.copyKeys ?? []);

	if (requestedCopyKeys.size > 0 && !composed) {
		throw new Error("Website section is not composed");
	}

	const truncatedCopyKeys: Array<string> = [];

	const copy = composed
		? Object.fromEntries(
				Object.entries(composed.content.en).map(([key, en]) => {
					const ar = stringValueSchema.parse(composed.content.ar[key]);
					const exact = requestedCopyKeys.has(key);

					const preview = (value: string) =>
						exact || value.length <= previewCharacters
							? value
							: `${value.slice(0, previewCharacters - 1)}…`;

					const projected = { ar: preview(ar), en: preview(en) };

					if (projected.en !== en || projected.ar !== ar) {
						truncatedCopyKeys.push(key);
					}

					return [key, projected];
				})
			)
		: null;

	for (const key of requestedCopyKeys) {
		if (!copy || !Object.hasOwn(copy, key)) {
			throw new Error(`Composed copy key "${key}" not found`);
		}
	}

	const layouts = target.pageId
		? listWebsitePageSectionLayouts({ document, pageId: target.pageId, sectionId: target.section.id })
		: [];

	const textPage = paginateTexts(
		listSectionTexts({ document, locale, section: target.section }).map(({ target: text, value }) => ({
			target: text,
			value,
		})),
		input.textOffset
	);

	return {
		scope: "section" as const,
		...inspection.base,
		area: target.area,
		collections: listSectionCollections({ document, section: target.section }).map(
			({ handle, items, max, min }) => ({
				handle,
				items: items.map((item) => item.handle),
				max,
				min,
			})
		),
		composed: composed && copy ? { copy, structure: composed.structure } : null,
		diagnostics: composed ? diagnoseComposedSection(composed) : [],
		generatedLayoutPatterns: layouts
			.filter(({ generationRequired }) => generationRequired)
			.map(({ pattern }) => pattern),
		layoutPatterns: layouts.filter(({ generationRequired }) => !generationRequired).map(({ pattern }) => pattern),
		links: listSectionLinks({ document, locale, section: target.section }).map(
			({ label, menuRole, parent, target: link, value }) => ({
				label,
				menuRole,
				parent: parent >= 0 ? `l${parent}` : null,
				target: link,
				value: projectLink(inspection, value),
			})
		),
		logic: inspectSectionLogic({ document, section: target.section }),
		media: listSectionContentReferences({ kind: "asset", node: target.section.root }).map((reference, index) => ({
			slot: "$asset" in reference ? reference.$asset : "",
			target: `m${index}`,
		})),
		nextTextOffset: textPage.nextOffset,
		page: target.pageId ? (inspection.pageHandleById.get(target.pageId) ?? null) : null,
		recommendedPattern: input.recommend
			? await recommendWebsiteSectionPattern({ ...context, patterns: layouts, request: input.recommend })
			: undefined,
		section: summarizeSection({ document, handle: target, locale }),
		texts: textPage.page,
		truncatedCopyKeys,
	};
};

export const inspectWebsiteTools = {
	inspectWebsite: createTool({
		description:
			"Inspect the active organization's website. Begin with selected scope in the editor. Page scope locates sections and insertion positions. Section scope returns exact structure and logic plus bounded copy previews; truncatedCopyKeys identifies shortened copy, and one copyKeys entry requests its exact bilingual value. Text results are bounded; continue with textOffset or offset when a next offset is returned. Catalog lists reviewed patterns. Context scope returns the resolved theme (hex surfaces, text tones safe per fill, fonts, corners) and design summaries of the sections adjacent to an insertion index. Use only revision-scoped p0/s0 handles returned here, never persistent IDs.",
		execute: async (input, { abortSignal, observe, requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "read" });
			const context = requestContext.all;
			const website = await getWebsite({ organizationId: context.organizationId });

			if (!website?.snapshot) {
				throw new Error("Website draft not found");
			}

			const { document } = website.snapshot;
			const locale = input.locale ?? context.websiteEditor?.locale ?? document.defaultLocale;

			if (!document.locales.includes(locale)) {
				throw new Error(`Website locale "${locale}" not found`);
			}

			const pages = listWebsitePageHandles({ document });
			const sections = listWebsiteSectionHandles({ document });

			const inspection: Inspection = {
				base: {
					activeWorkflow: website.workflow
						? { kind: website.workflow.kind, state: website.workflow.state }
						: null,
					locale,
					publication: website.publication,
					revision: website.updatedAt,
				},
				document,
				locale,
				pageHandleById: new Map(pages.map(({ handle, page }) => [page.id, handle])),
				pages,
				sectionHandleById: new Map(sections.map(({ handle, section }) => [section.id, handle])),
				sections,
				snapshot: website.snapshot,
			};

			const editor = context.websiteEditor;

			if (input.scope === "selected" && editor?.sectionId) {
				return inspectSection(
					inspection,
					{
						recommend: input.recommend,
						section: inspection.sectionHandleById.get(editor.sectionId) ?? "",
					},
					{ abortSignal, observe }
				);
			}

			if (input.scope === "section") {
				if (!input.section) {
					throw new Error("Section scope requires a section handle");
				}

				return inspectSection(inspection, { ...input, section: input.section }, { abortSignal, observe });
			}

			if (input.scope === "texts") {
				return inspectTexts(inspection, input);
			}

			if (input.scope === "catalog") {
				if (!input.page || input.index === undefined) {
					throw new Error("Catalog scope requires a page handle and an insertion index");
				}

				const patterns = listWebsiteSectionCatalog({
					category: input.category,
					index: input.index,
					pageId: findPage(inspection, input.page).id,
					query: input.query,
					snapshot: website.snapshot,
				});

				return {
					scope: "catalog" as const,
					...inspection.base,
					index: input.index,
					page: input.page,
					patterns: patterns
						.slice(0, 20)
						.map(({ category, pattern, templateAffinity }) => ({ category, pattern, templateAffinity })),
					recommendedPattern: input.recommend
						? await recommendWebsiteSectionPattern({
								abortSignal,
								observe,
								patterns,
								request: input.recommend,
							})
						: undefined,
					truncated: patterns.length > 20,
				};
			}

			if (input.scope === "reference") {
				return inspectReference(inspection, input, { abortSignal });
			}

			if (input.scope === "context") {
				return inspectContext(inspection, input);
			}

			if (input.scope === "page") {
				if (!input.page) {
					throw new Error("Page scope requires a page handle");
				}

				return inspectPage(inspection, input.page);
			}

			if (editor) {
				return inspectPage(inspection, inspection.pageHandleById.get(editor.pageId) ?? "");
			}

			return {
				scope: "site" as const,
				...inspection.base,
				layout: {
					footer: summarize(
						inspection,
						sections.filter(({ area }) => area === "footer")
					).map(withoutFrame),
					header: summarize(
						inspection,
						sections.filter(({ area }) => area === "header")
					).map(withoutFrame),
				},
				pages: pages.map(({ handle, page }) => ({
					page: handle,
					...pageDetails(inspection, page),
					sectionCount: page.sections.length,
				})),
			};
		},
		id: "inspect-website",
		inputSchema: z.compile(
			z.strictObject({
				category: z
					.enum(websiteGenerationSectionCategories)
					.optional()
					.describe("catalog scope: filter patterns."),
				contains: z.string().min(1).max(200).optional().describe("texts scope: only texts containing this."),
				copyKeys: z
					.array(contentKeySchema)
					.max(1)
					.optional()
					.describe("section scope: request one exact copy value."),
				index: z
					.number()
					.int()
					.nonnegative()
					.optional()
					.describe("catalog, reference, and context scopes: insertion index (required)."),
				locale: z.enum(iso6391LanguageCodes).optional(),
				offset: z
					.number()
					.int()
					.nonnegative()
					.optional()
					.describe("texts scope: continue from a returned nextOffset."),
				page: websitePageHandleSchema
					.optional()
					.describe(
						"page, catalog, reference, and context scopes: the inspected page handle (required); texts scope: optional filter."
					),
				query: z.string().trim().min(1).max(100).optional().describe("catalog scope: search patterns."),
				recommend: z
					.string()
					.trim()
					.min(1)
					.max(2000)
					.optional()
					.describe(
						'catalog or section scope: optionally recommend an eligible pattern for this semantic request. Returns null when none fits; use query only for literal name filtering. Adds one bounded evaluation; explicit choices need none. reference scope (required): only the requested section\'s purpose as a short phrase, such as "three-tier pricing comparison", never the conversation; returns up to three diverse reviewed section layouts, or none with a reason.'
					),
				scope: z.enum(["selected", "site", "page", "section", "texts", "catalog", "reference", "context"]),
				section: websiteSectionHandleSchema
					.optional()
					.describe("section scope: the inspected section handle (required)."),
				textOffset: z
					.number()
					.int()
					.nonnegative()
					.optional()
					.describe("section scope: continue texts from a returned nextTextOffset."),
			})
		),
		requestContextSchema: appContextSchema,
	}),
};
