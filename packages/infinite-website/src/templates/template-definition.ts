import {
	localizedContentSchema,
	jsonObjectSchema,
	mergeContentValue,
	pageContentSchema,
	patternKeySchema,
	iso6391LanguageCodeSchema,
	siteContentSchema,
	type JsonObject,
} from "../document/content-schema";
import type { SiteDocument } from "../document/site-document-schema";
import type { Iso6391LanguageCode } from "../language-codes";
import {
	instantiateSection,
	type CreateEntityId,
	type LocalizedSectionContent,
	type SectionDefinition,
} from "../sections/section-definition";

type TemplateSectionMap = Record<string, SectionDefinition>;

type TemplatePageDefinition = {
	home: boolean;
	sections: TemplateSectionMap;
};

export type TemplateDefinition = {
	defaultLocale: Iso6391LanguageCode;
	description: string;
	direction?: "ltr" | "rtl";
	documentVersion: 1;
	id: string;
	layout: {
		footer: TemplateSectionMap;
		header: TemplateSectionMap;
	};
	locales: Array<Iso6391LanguageCode>;
	name: string;
	pages: Record<string, TemplatePageDefinition>;
	tags: Array<string>;
};

type TemplateSectionContentMap = Record<string, JsonObject>;

type TemplatePageContent = {
	page: JsonObject;
	sections: TemplateSectionContentMap;
};

type TemplateLocaleContent = {
	layout: {
		footer: TemplateSectionContentMap;
		header: TemplateSectionContentMap;
	};
	pages: Record<string, TemplatePageContent>;
	site: JsonObject;
};

export type TemplateContent = Partial<Record<Iso6391LanguageCode, TemplateLocaleContent>>;

type TemplateAuthoringDefinition = Omit<
	TemplateDefinition,
	"defaultLocale" | "description" | "documentVersion" | "locales" | "name" | "tags"
> &
	Partial<
		Pick<TemplateDefinition, "defaultLocale" | "description" | "documentVersion" | "locales" | "name" | "tags">
	>;

export const defineTemplate = ({
	defaultLocale = "en",
	description,
	documentVersion = 1,
	id,
	locales = ["en", "ar"],
	name = id
		.split("-")
		.map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
		.join(" "),
	tags,
	...definition
}: TemplateAuthoringDefinition) => {
	return {
		...definition,
		defaultLocale,
		description: description ?? `${name} website template.`,
		documentVersion,
		id,
		locales,
		name,
		tags:
			tags ??
			Array.from(
				new Set(
					Object.values(definition.pages).flatMap((page) =>
						Object.values(page.sections).map((section) => section.category)
					)
				)
			),
	};
};

const assertExactKeys = ({
	actualKeys,
	expectedKeys,
	path,
}: {
	actualKeys: Array<string>;
	expectedKeys: Array<string>;
	path: string;
}) => {
	const sortedActualKeys = actualKeys.toSorted();
	const sortedExpectedKeys = expectedKeys.toSorted();

	if (
		sortedActualKeys.length !== sortedExpectedKeys.length ||
		sortedActualKeys.some((key, index) => key !== sortedExpectedKeys[index])
	) {
		throw new Error(`Template content at "${path}" must use exactly these keys: ${sortedExpectedKeys.join(", ")}`);
	}
};

const instantiateTemplateSection = ({
	anchor,
	content,
	createId,
	defaultLocale,
	definition,
	path,
}: {
	anchor: string;
	content: LocalizedSectionContent;
	createId: CreateEntityId;
	defaultLocale: Iso6391LanguageCode;
	definition: SectionDefinition;
	path: string;
}) => {
	try {
		return instantiateSection({ anchor, content, createId, defaultLocale, definition, path });
	} catch (error) {
		throw new Error(`Failed to instantiate section "${definition.pattern}"`, { cause: error });
	}
};

const collectLocalizedSectionContent = ({
	locales,
	read,
}: {
	locales: Array<Iso6391LanguageCode>;
	read: ({ locale }: { locale: Iso6391LanguageCode }) => JsonObject | undefined;
}) => {
	return Object.fromEntries(
		locales.flatMap((locale) => {
			const value = read({ locale });

			return value === undefined ? [] : [[locale, value]];
		})
	) satisfies LocalizedSectionContent;
};

const instantiateSectionMap = ({
	createId,
	defaultLocale,
	definitions,
	locales,
	localizedContent,
	path,
	readContent,
}: {
	createId: CreateEntityId;
	defaultLocale: Iso6391LanguageCode;
	definitions: TemplateSectionMap;
	locales: Array<Iso6391LanguageCode>;
	localizedContent: Record<
		string,
		{ pages: Record<string, JsonObject>; sections: Record<string, JsonObject>; site: JsonObject }
	>;
	path: string;
	readContent: ({ key, locale }: { key: string; locale: Iso6391LanguageCode }) => JsonObject | undefined;
}) => {
	return Object.entries(definitions).map(([key, definition]) => {
		patternKeySchema.parse(key);

		const content = collectLocalizedSectionContent({
			locales,
			read: ({ locale }) => readContent({ key, locale }),
		});

		const instance = instantiateTemplateSection({
			anchor: key,
			content,
			createId,
			defaultLocale,
			definition,
			path: `${path}/${key}`,
		});

		Object.entries(instance.content).forEach(([locale, value]) => {
			const localeContent = localizedContent[locale];
			const parsedValue = jsonObjectSchema.safeParse(value);

			if (parsedValue.success && localeContent) {
				localeContent.sections[instance.section.contentId] = parsedValue.data;
			}
		});

		return instance.section;
	});
};

export const instantiateTemplate = ({
	content,
	createId,
	definition,
	path,
}: {
	content: TemplateContent;
	createId: CreateEntityId;
	definition: TemplateDefinition;
	path: string;
}) => {
	patternKeySchema.parse(definition.id);
	const defaultContent = content[definition.defaultLocale];

	if (!defaultContent) {
		throw new Error(
			`Template "${definition.id}" is missing default content for locale "${definition.defaultLocale}"`
		);
	}

	const templateLocales = new Set(definition.locales);

	Object.keys(content).forEach((locale) => {
		if (!templateLocales.has(iso6391LanguageCodeSchema.parse(locale))) {
			throw new Error(`Template "${definition.id}" contains unlisted locale "${locale}"`);
		}
	});

	const localizedContent: Record<
		string,
		{ pages: Record<string, JsonObject>; sections: Record<string, JsonObject>; site: JsonObject }
	> = Object.fromEntries(
		definition.locales.map((locale) => {
			const localized = content[locale];

			if (localized) {
				assertExactKeys({
					actualKeys: Object.keys(localized.layout.header),
					expectedKeys: Object.keys(definition.layout.header),
					path: `${locale}/layout/header`,
				});

				assertExactKeys({
					actualKeys: Object.keys(localized.layout.footer),
					expectedKeys: Object.keys(definition.layout.footer),
					path: `${locale}/layout/footer`,
				});

				assertExactKeys({
					actualKeys: Object.keys(localized.pages),
					expectedKeys: Object.keys(definition.pages),
					path: `${locale}/pages`,
				});
			}

			const site = mergeContentValue({ fallback: defaultContent.site, localized: localized?.site });
			siteContentSchema.parse(site);

			return [locale, { pages: {}, sections: {}, site: localized?.site ?? {} }];
		})
	);

	const header = instantiateSectionMap({
		createId,
		defaultLocale: definition.defaultLocale,
		definitions: definition.layout.header,
		locales: definition.locales,
		localizedContent,
		path: `${path}/layout/header`,
		readContent: ({ key, locale }) => content[locale]?.layout.header[key],
	});

	const footer = instantiateSectionMap({
		createId,
		defaultLocale: definition.defaultLocale,
		definitions: definition.layout.footer,
		locales: definition.locales,
		localizedContent,
		path: `${path}/layout/footer`,
		readContent: ({ key, locale }) => content[locale]?.layout.footer[key],
	});

	const pages = Object.entries(definition.pages).map(([pageKey, pageDefinition]) => {
		patternKeySchema.parse(pageKey);
		const pagePath = `${path}/pages/${pageKey}`;
		const pageId = createId({ kind: "page", path: pagePath });

		definition.locales.forEach((locale) => {
			const pageContent = content[locale]?.pages[pageKey];

			if (!pageContent) {
				return;
			}

			const completePageContent = mergeContentValue({
				fallback: defaultContent.pages[pageKey]?.page,
				localized: pageContent.page,
			});

			pageContentSchema.parse(completePageContent);

			assertExactKeys({
				actualKeys: Object.keys(pageContent.sections),
				expectedKeys: Object.keys(pageDefinition.sections),
				path: `${locale}/pages/${pageKey}/sections`,
			});

			const target = localizedContent[locale];

			if (target) {
				target.pages[pageId] = pageContent.page;
			}
		});

		const sections = instantiateSectionMap({
			createId,
			defaultLocale: definition.defaultLocale,
			definitions: pageDefinition.sections,
			locales: definition.locales,
			localizedContent,
			path: `${pagePath}/sections`,
			readContent: ({ key, locale }) => content[locale]?.pages[pageKey]?.sections[key],
		});

		return { home: pageDefinition.home, id: pageId, sections };
	});

	return {
		content: localizedContentSchema.parse(localizedContent),
		defaultLocale: definition.defaultLocale,
		direction: definition.direction,
		documentVersion: definition.documentVersion,
		locales: definition.locales,
		structure: { layout: { footer, header }, pages },
	} satisfies SiteDocument;
};
