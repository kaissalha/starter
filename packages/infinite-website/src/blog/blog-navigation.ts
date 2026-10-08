import { jsonObjectSchema, linkValueSchema, resolveSectionContentReference } from "../document/content-schema";
import { listSectionLinkElementReferences } from "../document/section-content-references";
import type { SiteDocument } from "../document/site-document-schema";
import { type SiteNodeDefinition, siteNodeSchema } from "../document/structure-schema";
import { entityIdFromSeed } from "../sections/entity-id";
import { mapSiteNodeDefinition } from "../sections/section-definition";
import { getBlogLabels } from "./blog-labels";

export const withBlogNavigation = (
	document: SiteDocument,
	{ includeHidden = false }: { includeHidden?: boolean } = {}
): SiteDocument => {
	if (!includeHidden && document.blogNavigationHidden) {
		return document;
	}

	for (const section of document.structure.layout.header) {
		const existing = listSectionLinkElementReferences({ node: section.root }).some(({ pointer }) => {
			const value = linkValueSchema.parse(
				resolveSectionContentReference({
					content: document.content,
					contentId: section.contentId,
					defaultLocale: document.defaultLocale,
					locale: document.defaultLocale,
					reference: { $link: pointer },
				})
			);

			return value.kind === "relative" && value.path === "/blog";
		});

		if (existing) {
			return document;
		}
	}

	for (const section of document.structure.layout.header) {
		const edit = { added: false };
		const itemId = entityIdFromSeed({ seed: `blog-navigation:${section.id}` });
		const labelPointer = `/authoring/menu/${itemId}/items/${itemId}/label`;
		const linkPointer = `/authoring/menu/${itemId}/items/${itemId}/link`;

		const root = mapSiteNodeDefinition({
			map: ({ node }) => {
				if (node.type !== "menu" || edit.added) {
					return undefined;
				}

				edit.added = true;
				const reference = node.props.items.findLast((item) => !item.panel) ?? node.props.items.at(-1);

				const labelNode = (nodes: Array<SiteNodeDefinition> | undefined, seed: string) => {
					const [textProps = { element: "span", font: "body", fontSize: "1rem", tone: "current" }] =
						nodes?.flatMap((child) => (child.type === "text" ? [child.props] : [])) ?? [];

					return {
						id: entityIdFromSeed({ seed: `${seed}:${section.id}` }),
						props: { ...textProps, content: { $text: labelPointer } },
						type: "text",
					} as const;
				};

				const item = {
					href: { $link: linkPointer },
					id: itemId,
					trigger: [labelNode(reference?.trigger, "blog-navigation-label")],
				};

				const mobileTrigger = reference?.mobileTrigger;

				return {
					...node,
					props: {
						...node.props,
						items: [
							...node.props.items,
							mobileTrigger
								? { ...item, mobileTrigger: [labelNode(mobileTrigger, "blog-navigation-mobile-label")] }
								: item,
						],
					},
				};
			},
			node: section.root,
		});

		if (!edit.added) {
			continue;
		}

		const parsedRoot = siteNodeSchema.parse(root);

		if (parsedRoot.type !== "box") {
			throw new Error("Header root must be a box");
		}

		const content = { ...document.content };

		for (const locale of document.locales) {
			const localized = document.content[locale] ?? document.content[document.defaultLocale];

			if (!localized) {
				continue;
			}

			const authoring = jsonObjectSchema.parse(localized.sections[section.contentId]?.authoring ?? {});
			content[locale] = {
				...localized,
				sections: {
					...localized.sections,
					[section.contentId]: {
						...localized.sections[section.contentId],
						authoring: {
							menu: {
								...jsonObjectSchema.parse(authoring.menu ?? {}),
								[itemId]: {
									items: {
										[itemId]: {
											label: getBlogLabels({ document, locale }).title,
											link: {
												kind: "relative",
												path: "/blog",
											},
										},
									},
								},
							},
						},
					},
				},
			};
		}

		return {
			...document,
			content,
			structure: {
				...document.structure,
				layout: {
					...document.structure.layout,
					header: document.structure.layout.header.map((header) =>
						header.id === section.id ? { ...header, root: parsedRoot } : header
					),
				},
			},
		};
	}

	return document;
};
