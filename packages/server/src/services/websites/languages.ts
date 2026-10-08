import { editWebsiteSnapshots, WebsiteEditError, type WebsiteEditInput } from "@starter/infinite-website/editing";
import { getBlogLabels, blogLabelsSchema, type WebsiteSnapshotV1 } from "@starter/infinite-website/generation";

import { listSectionTexts, listWebsiteSectionHandles } from "../../ai/website-texts";
import { translateContentFields } from "../content-translation";

export const prepareWebsiteLanguage = async ({
	input,
	snapshot,
}: {
	input: Extract<WebsiteEditInput, { operation: "add-language" }>;
	snapshot: Pick<WebsiteSnapshotV1, "brand" | "document">;
}) => {
	const { document } = snapshot;

	if (document.locales.includes(input.locale)) {
		throw new WebsiteEditError();
	}

	const source = document.content[document.defaultLocale];

	if (!source) {
		throw new WebsiteEditError();
	}

	const texts = listWebsiteSectionHandles({ document }).flatMap(({ section }) =>
		listSectionTexts({ document, locale: document.defaultLocale, section }).map((field) => ({
			...field,
			sectionId: section.id,
		}))
	);

	const metadata = [
		source.site.name ?? "",
		source.site.description ?? "",
		...Object.values(source.pages).flatMap((page) => [page.seo?.title ?? "", page.seo?.description ?? ""]),
	];

	const blog = getBlogLabels({ document, locale: document.defaultLocale });

	const translated = await translateContentFields({
		fields: [...metadata, ...texts.map(({ value }) => value), ...Object.values(blog)],
		locale: input.locale,
		sourceLocale: document.defaultLocale,
	});

	const content = {
		...source,
		pages: Object.fromEntries(
			Object.entries(source.pages).map(([id, page], index) => [
				id,
				{
					...page,
					seo: {
						...page.seo,
						description: page.seo?.description ? translated[3 + index * 2] : undefined,
						title: translated[2 + index * 2],
					},
				},
			])
		),
		site: {
			...source.site,
			blog: blogLabelsSchema.parse(
				Object.fromEntries(
					Object.keys(blog).map((key, index) => [key, translated[metadata.length + texts.length + index]])
				)
			),
			description: source.site.description ? translated[1] : undefined,
			name: translated[0],
		},
	};

	const edited = editWebsiteSnapshots({
		inputs: [
			{ ...input, content },
			...texts.map(({ pointer, sectionId }, index) => ({
				locale: input.locale,
				operation: "update-text" as const,
				pointer,
				sectionId,
				value: translated[metadata.length + index]!,
			})),
		],
		snapshot,
	});

	return { ...input, content: edited.document.content[input.locale] };
};
