import { z } from "zod";

import { entityIdSchema, jsonObjectSchema, linkValueSchema, patternKeySchema, type JsonValue } from "./content-schema";
import { parseSiteDocument } from "./document-validation";
import { swapWebsitePageSectionLayout } from "./page-section-layout";
import type { SiteDocument } from "./site-document-schema";

const websitePageSectionTargetSchema = { pageId: entityIdSchema, sectionId: entityIdSchema };

export const websitePageSectionEditInputSchema = z.compile(
	z.discriminatedUnion("operation", [
		z.strictObject({ ...websitePageSectionTargetSchema, operation: z.literal("delete") }),
		z.strictObject({ ...websitePageSectionTargetSchema, operation: z.literal("move-down") }),
		z.strictObject({ ...websitePageSectionTargetSchema, operation: z.literal("move-up") }),
		z.strictObject({
			...websitePageSectionTargetSchema,
			operation: z.literal("swap-layout"),
			pattern: patternKeySchema,
		}),
	])
);

export type WebsitePageSectionEditInput = z.infer<typeof websitePageSectionEditInputSchema>;

export class WebsitePageSectionEditError extends Error {
	constructor() {
		super("The requested page section operation is unavailable.");
		this.name = "WebsitePageSectionEditError";
	}
}

const redirectDeletedSectionLinks = ({
	anchor,
	pageId,
	sectionId,
	value,
}: {
	anchor: string;
	pageId: string;
	sectionId: string;
	value: JsonValue;
}): JsonValue => {
	if (Array.isArray(value)) {
		return value.map((item) => redirectDeletedSectionLinks({ anchor, pageId, sectionId, value: item }));
	}

	const object = jsonObjectSchema.safeParse(value);

	if (!object.success) {
		return value;
	}

	const link = linkValueSchema.safeParse(value);

	const targetsDeletedSection =
		link.success &&
		((link.data.kind === "anchor" && link.data.anchor === anchor) ||
			(link.data.kind === "section" && link.data.sectionId === sectionId) ||
			(link.data.kind === "page" && link.data.sectionId === sectionId));

	if (targetsDeletedSection) {
		return { kind: "page", pageId };
	}

	return Object.fromEntries(
		Object.entries(object.data).flatMap(([key, child]) =>
			child === undefined ? [] : [[key, redirectDeletedSectionLinks({ anchor, pageId, sectionId, value: child })]]
		)
	);
};

export const applyWebsitePageSectionEdit = ({
	document,
	...input
}: { document: SiteDocument } & WebsitePageSectionEditInput) => {
	const parsed = websitePageSectionEditInputSchema.parse(input);
	const { operation, pageId, sectionId } = parsed;
	const pageIndex = document.structure.pages.findIndex((page) => page.id === pageId);
	const page = document.structure.pages[pageIndex];

	if (!page) {
		throw new WebsitePageSectionEditError();
	}

	const sectionIndex = page.sections.findIndex((section) => section.id === sectionId);
	const section = page.sections[sectionIndex];

	if (!section) {
		throw new WebsitePageSectionEditError();
	}

	if (operation === "swap-layout") {
		if (document.logic?.[sectionId]) {
			throw new WebsitePageSectionEditError();
		}

		const updated = swapWebsitePageSectionLayout({
			document,
			pageId,
			pattern: parsed.pattern,
			sectionId,
			validateDocument: false,
		});

		if (!updated) {
			throw new WebsitePageSectionEditError();
		}

		return updated;
	}

	if (operation === "delete") {
		const content = Object.fromEntries(
			Object.entries(document.content).flatMap(([locale, localeContent]) => {
				if (!localeContent) {
					return [];
				}

				const sections = { ...localeContent.sections };
				delete sections[section.contentId];

				return [
					[
						locale,
						redirectDeletedSectionLinks({
							anchor: section.anchor,
							pageId,
							sectionId,
							value: { ...localeContent, sections },
						}),
					],
				];
			})
		);

		const { [sectionId]: _removedLogic, ...remainingLogic } = document.logic ?? {};

		const nextDocument = {
			...document,
			content,
			structure: {
				...document.structure,
				pages: document.structure.pages.with(pageIndex, {
					...page,
					sections: page.sections.filter((candidate) => candidate.id !== sectionId),
				}),
			},
		};

		if (document.logic) {
			Object.assign(nextDocument, { logic: remainingLogic });
		}

		return nextDocument;
	}

	const destinationIndex = operation === "move-up" ? sectionIndex - 1 : sectionIndex + 1;
	const destination = page.sections[destinationIndex];

	if (!destination) {
		throw new WebsitePageSectionEditError();
	}

	const sections = page.sections.with(sectionIndex, destination).with(destinationIndex, section);

	const nextDocument: SiteDocument = {
		...document,
		structure: {
			...document.structure,
			pages: document.structure.pages.with(pageIndex, { ...page, sections }),
		},
	};

	return nextDocument;
};

export const editWebsitePageSection = ({
	document,
	...input
}: { document: SiteDocument } & WebsitePageSectionEditInput) =>
	parseSiteDocument(applyWebsitePageSectionEdit({ document, ...input }));
