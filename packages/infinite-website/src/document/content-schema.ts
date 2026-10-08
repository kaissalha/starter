import { z } from "zod";

import { blogLabelsSchema } from "../blog/blog-labels";
import { iso6391LanguageCodes, type Iso6391LanguageCode } from "../language-codes";

export const pendingTextContent = "\u200b";

const arrayIndexPattern = /^(?:0|[1-9]\d*)$/u;

export const stringValueSchema = z.compile(z.string());

export const jsonValueSchema = z.json();

export const jsonObjectSchema = z.record(z.string(), jsonValueSchema);

export type JsonValue = boolean | JsonObject | Array<JsonValue> | null | number | string;

export type JsonObject = { [key: string]: JsonValue | undefined };

export type AuthoringJsonValue =
	| boolean
	| AuthoringJsonObject
	| Array<AuthoringJsonValue>
	| null
	| number
	| string
	| undefined;

export type AuthoringJsonObject = { [key: string]: AuthoringJsonValue };

export const isJsonObject = (value: JsonValue | undefined): value is JsonObject =>
	value !== null && Object(value) === value && !Array.isArray(value);

export const authoringJsonValueSchema: z.ZodType<AuthoringJsonValue> = z.lazy(() =>
	z.union([
		z.boolean(),
		z.number(),
		z.string(),
		z.null(),
		z.undefined(),
		z.array(authoringJsonValueSchema),
		z.record(z.string(), authoringJsonValueSchema),
	])
);

export const authoringJsonObjectSchema = z.record(z.string(), authoringJsonValueSchema);

export const isContentArrayIndex = ({ segment }: { segment: string }) => arrayIndexPattern.test(segment);

export const decodeContentPointer = ({ pointer }: { pointer: string }) => {
	return pointer
		.slice(1)
		.split("/")
		.map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
};

export const encodeContentPointer = ({ segments }: { segments: Array<string> }) => {
	return `/${segments.map((segment) => segment.replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`;
};

export const findCollectionItem = ({ pointer }: { pointer: string }) => {
	const segments = decodeContentPointer({ pointer });
	const itemsIndex = segments.lastIndexOf("items");

	if (itemsIndex === -1) {
		return undefined;
	}

	const item = segments[itemsIndex + 1];

	if (!item) {
		return undefined;
	}

	return {
		collectionPointer: encodeContentPointer({ segments: segments.slice(0, itemsIndex) }),
		item,
		itemsIndex,
		segments,
	};
};

export const patternKeySchema = z.compile(
	z
		.string()
		.min(1)
		.regex(
			/^[A-Za-z][A-Za-z0-9_-]*$/u,
			"Registry keys must start with a letter and contain only letters, numbers, _ or -"
		)
);

export const entityIdSchema = z.compile(z.uuid());

export const iso6391LanguageCodeSchema = z.compile(z.enum(iso6391LanguageCodes));

export const jsonPointerSchema = z.compile(
	z
		.string()
		.startsWith("/")
		.regex(/^(?:\/(?:[^~/]|~0|~1)*)+$/u, "Content pointers must use RFC 6901 escaping")
);

export const textReferenceSchema = z.compile(z.strictObject({ $text: jsonPointerSchema }));

export const linkReferenceSchema = z.compile(z.strictObject({ $link: jsonPointerSchema }));

export const assetReferenceSchema = z.compile(z.strictObject({ $asset: jsonPointerSchema }));

export const settingReferenceSchema = z.compile(z.strictObject({ $setting: jsonPointerSchema }));

export const contentReferenceSchema = z.compile(
	z.union([textReferenceSchema, linkReferenceSchema, assetReferenceSchema])
);

const webUrlSchema = z.url().refine((value) => {
	const protocol = new URL(value).protocol;

	return protocol === "http:" || protocol === "https:";
}, "URLs must use HTTP or HTTPS");

const relativePathSchema = z
	.string()
	.min(1)
	.refine(
		(value) =>
			value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !/\p{Cc}|\p{Z}/u.test(value),
		"Relative paths must be root-relative and cannot contain whitespace or control characters"
	);

export const anchorSchema = z.compile(
	z
		.string()
		.min(1)
		.regex(
			/^[A-Za-z][A-Za-z0-9_-]*$/u,
			"Anchors must start with a letter and contain only letters, numbers, _ or -"
		)
);

export const linkValueSchema = z.compile(
	z.discriminatedUnion("kind", [
		z.strictObject({ kind: z.literal("external"), url: webUrlSchema }),
		z.strictObject({ kind: z.literal("relative"), path: relativePathSchema }),
		z.strictObject({ kind: z.literal("page"), pageId: entityIdSchema, sectionId: entityIdSchema.optional() }),
		z.strictObject({ kind: z.literal("section"), sectionId: entityIdSchema }),
		z.strictObject({ anchor: anchorSchema, kind: z.literal("anchor") }),
		z.strictObject({ address: z.email(), kind: z.literal("email") }),
		z.strictObject({
			kind: z.literal("phone"),
			number: z.string().regex(/^\+[1-9]\d{7,14}$/u, "Phone numbers must use E.164 format"),
		}),
		z.strictObject({ kind: z.literal("booking"), url: webUrlSchema }),
	])
);

const semanticContentObjectSchema = z.record(z.string().min(1), z.json());

export const siteContentSchema = z.compile(
	z.strictObject({
		blog: blogLabelsSchema.optional(),
		description: z.string().min(1).optional(),
		name: z.string().min(1),
	})
);

export const pageSlugSchema = z.compile(
	z
		.string()
		.min(1)
		.max(240)
		.refine(
			(value) =>
				value === value.trim() &&
				!value.startsWith("/") &&
				!value.endsWith("/") &&
				!value.includes("//") &&
				!value.includes("\\") &&
				!/[?#]|\p{Cc}|\p{Z}/u.test(value) &&
				value.split("/").every((segment) => segment !== "." && segment !== ".."),
			"Page slugs must contain safe, non-empty path segments"
		)
);

export const pageContentSchema = z.compile(
	z.strictObject({
		route: z.strictObject({ slug: pageSlugSchema }),
		seo: z.strictObject({
			description: z.string().min(1).optional(),
			imageAssetId: entityIdSchema.optional(),
			title: z.string().min(1),
		}),
	})
);

const siteContentOverlaySchema = z.strictObject({
	blog: blogLabelsSchema.optional(),
	description: z.string().min(1).optional(),
	name: z.string().min(1).optional(),
});

const pageContentOverlaySchema = z.strictObject({
	route: z.strictObject({ slug: pageSlugSchema.optional() }).optional(),
	seo: z
		.strictObject({
			description: z.string().min(1).optional(),
			imageAssetId: entityIdSchema.optional(),
			title: z.string().min(1).optional(),
		})
		.optional(),
});

export const localeContentSchema = z.strictObject({
	pages: z.record(entityIdSchema, pageContentOverlaySchema),
	sections: z.record(entityIdSchema, semanticContentObjectSchema),
	site: siteContentOverlaySchema,
});

export const localizedContentSchema = z.partialRecord(iso6391LanguageCodeSchema, localeContentSchema);

export type AssetReference = z.infer<typeof assetReferenceSchema>;

export type ContentReference = z.infer<typeof contentReferenceSchema>;

export type LinkReference = z.infer<typeof linkReferenceSchema>;

export type LinkValue = z.infer<typeof linkValueSchema>;

export type LocaleContent = z.infer<typeof localeContentSchema>;

export type LocalizedContent = z.infer<typeof localizedContentSchema>;

export type TextReference = z.infer<typeof textReferenceSchema>;

export type SettingReference = z.infer<typeof settingReferenceSchema>;

export const readContentPointer = ({ pointer, value }: { pointer: string; value: JsonValue | undefined }) =>
	decodeContentPointer({ pointer }).reduce<JsonValue | undefined>((current, segment) => {
		return isJsonObject(current) ? current[segment] : undefined;
	}, value);

export const mergeContentValue = ({
	fallback,
	localized,
}: {
	fallback: JsonValue | undefined;
	localized: JsonValue | undefined;
}): JsonValue | undefined => {
	if (localized === undefined) {
		return fallback;
	}

	const fallbackObject = isJsonObject(fallback) ? fallback : undefined;
	const localizedObject = isJsonObject(localized) ? localized : undefined;

	if (!fallbackObject || !localizedObject) {
		return localized;
	}

	if (Object.hasOwn(localizedObject, "kind") && linkValueSchema.safeParse(localizedObject).success) {
		return localizedObject;
	}

	return Object.fromEntries(
		Array.from(new Set([...Object.keys(fallbackObject), ...Object.keys(localizedObject)])).map((key) => [
			key,
			mergeContentValue({ fallback: fallbackObject[key], localized: localizedObject[key] }),
		])
	);
};

type ContentArea = "pages" | "sections" | "site";

const contentRoot = ({
	area,
	content,
	id,
	locale,
}: {
	area: ContentArea;
	content: LocalizedContent;
	id?: string;
	locale: Iso6391LanguageCode;
}) => {
	const localeContent = content[locale];

	if (!localeContent) {
		return undefined;
	}

	if (area === "site") {
		return localeContent.site;
	}

	return id ? localeContent[area][id] : undefined;
};

export const resolveLocalizedContent = ({
	area,
	content,
	defaultLocale,
	id,
	locale,
	pointer,
}: {
	area: ContentArea;
	content: LocalizedContent;
	defaultLocale: Iso6391LanguageCode;
	id?: string;
	locale: Iso6391LanguageCode;
	pointer: string;
}) => {
	const fallback = readContentPointer({
		pointer,
		value: contentRoot({ area, content, id, locale: defaultLocale }),
	});

	const localized = readContentPointer({ pointer, value: contentRoot({ area, content, id, locale }) });
	const value = mergeContentValue({ fallback, localized });

	if (value === undefined) {
		throw new Error(`Missing ${area} content at "${pointer}" for locale "${locale}"`);
	}

	return value;
};

export const resolveLocalizedPageSlug = ({
	content,
	defaultLocale,
	locale,
	pageId,
}: {
	content: LocalizedContent;
	defaultLocale: Iso6391LanguageCode;
	locale: Iso6391LanguageCode;
	pageId: string;
}) => {
	const value = resolveLocalizedContent({
		area: "pages",
		content,
		defaultLocale,
		id: pageId,
		locale,
		pointer: "/route/slug",
	});

	const slug = stringValueSchema.safeParse(value);

	if (!slug.success) {
		throw new Error(`Invalid page slug for locale "${locale}"`);
	}

	return slug.data;
};

export const contentReferencePointer = ({ reference }: { reference: ContentReference }) => Object.values(reference)[0]!;

export const resolveSectionContentReference = ({
	content,
	contentId,
	defaultLocale,
	locale,
	reference,
}: {
	content: LocalizedContent;
	contentId: string;
	defaultLocale: Iso6391LanguageCode;
	locale: Iso6391LanguageCode;
	reference: ContentReference;
}) => {
	const value = resolveLocalizedContent({
		area: "sections",
		content,
		defaultLocale,
		id: contentId,
		locale,
		pointer: contentReferencePointer({ reference }),
	});

	if (Object.hasOwn(reference, "$link")) {
		const link = linkValueSchema.safeParse(value);

		if (!link.success) {
			throw new Error(
				`Invalid link content at "${contentReferencePointer({ reference })}" for locale "${locale}"`
			);
		}

		return link.data;
	}

	const contentValue = stringValueSchema.safeParse(value);

	if (!contentValue.success) {
		throw new Error(`Invalid content at "${contentReferencePointer({ reference })}" for locale "${locale}"`);
	}

	return contentValue.data;
};
