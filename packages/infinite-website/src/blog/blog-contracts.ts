import { z } from "zod";

import { iso6391LanguageCodeSchema } from "../document/content-schema";
import { iso6391LanguageCodes, type Iso6391LanguageCode } from "../language-codes";

export const blogUrlSchema = z
	.string()
	.max(2048)
	.refine((value) => {
		if (value.trim() !== value || /[\p{Cc}\\]/u.test(value)) {
			return false;
		}

		if (value.startsWith("/") && !value.startsWith("//")) {
			return true;
		}

		if (!URL.canParse(value)) {
			return false;
		}

		const url = new URL(value);

		return url.protocol === "https:" && !url.username && !url.password;
	}, "Use an HTTPS URL or a site-relative path");

const blogMarkSchema = z.discriminatedUnion("type", [
	z.strictObject({ type: z.literal("bold") }),
	z.strictObject({ type: z.literal("italic") }),
	z.strictObject({
		attrs: z.strictObject({
			class: z.null().optional(),
			href: blogUrlSchema,
			rel: z.string().max(100).nullable().optional(),
			target: z.literal("_blank").nullable().optional(),
		}),
		type: z.literal("link"),
	}),
]);

export type BlogNode =
	| { marks?: Array<z.infer<typeof blogMarkSchema>>; text: string; type: "text" }
	| { content?: Array<BlogNode>; type: "paragraph" | "blockquote" | "bulletList" | "listItem" }
	| { attrs: { level: 2 | 3 }; content?: Array<BlogNode>; type: "heading" }
	| { attrs?: { start: number }; content?: Array<BlogNode>; type: "orderedList" }
	| { type: "hardBreak" }
	| {
			attrs: {
				alt: string | null;
				height?: number | null;
				src: string;
				title?: string | null;
				width?: number | null;
			};
			type: "image";
	  };

const blogNodeSchema: z.ZodType<BlogNode> = z.lazy(() =>
	z.discriminatedUnion("type", [
		z.strictObject({
			marks: z.array(blogMarkSchema).max(3).optional(),
			text: z.string().min(1).max(50_000),
			type: z.literal("text"),
		}),
		z.strictObject({
			content: z.array(blogNodeSchema).max(500).optional(),
			type: z.enum(["paragraph", "blockquote", "bulletList", "listItem"]),
		}),
		z.strictObject({
			attrs: z.strictObject({ level: z.union([z.literal(2), z.literal(3)]) }),
			content: z.array(blogNodeSchema).max(500).optional(),
			type: z.literal("heading"),
		}),
		z.strictObject({
			attrs: z.strictObject({ start: z.number().int().min(1).max(10_000) }).optional(),
			content: z.array(blogNodeSchema).max(500).optional(),
			type: z.literal("orderedList"),
		}),
		z.strictObject({ type: z.literal("hardBreak") }),
		z.strictObject({
			attrs: z.strictObject({
				alt: z.string().max(500).nullable(),
				height: z.number().positive().max(10_000).nullable().optional(),
				src: blogUrlSchema,
				title: z.string().max(500).nullable().optional(),
				width: z.number().positive().max(10_000).nullable().optional(),
			}),
			type: z.literal("image"),
		}),
	])
);

const validChildren = (node: BlogNode) => {
	if (node.type === "text" || node.type === "hardBreak" || node.type === "image") {
		return true;
	}

	const children = node.content ?? [];

	if (node.type === "paragraph" || node.type === "heading") {
		return children.every((child) => child.type === "text" || child.type === "hardBreak");
	}

	if (node.type === "bulletList" || node.type === "orderedList") {
		return children.length > 0 && children.every((child) => child.type === "listItem");
	}

	if (node.type === "listItem" && children[0]?.type !== "paragraph") {
		return false;
	}

	return children.length > 0 && children.every((child) => !["text", "hardBreak", "listItem"].includes(child.type));
};

const blogBodyStructureSchema = z
	.strictObject({ content: z.array(blogNodeSchema).min(1).max(500), type: z.literal("doc") })
	.superRefine((body, context) => {
		const resource = { count: 0 };

		const visit = (nodes: Array<BlogNode>, depth: number): boolean =>
			nodes.every((node) => {
				resource.count += 1;

				return (
					resource.count <= 2000 &&
					depth <= 12 &&
					validChildren(node) &&
					(!("content" in node) || visit(node.content ?? [], depth + 1))
				);
			});

		if (
			body.content.some((node) => ["text", "hardBreak", "listItem"].includes(node.type)) ||
			!visit(body.content, 0)
		) {
			context.addIssue({ code: "custom", message: "Invalid or excessively complex article structure" });
		}
	});

type BlogBodyInput = z.input<typeof blogBodyStructureSchema>;

const rawBlogNodeSchema = z.looseObject({
	content: z.array(z.custom<BlogNode>()).max(500).optional(),
	text: z.string().max(50_000).optional(),
});

const hasBoundedBlogBody = (input: BlogBodyInput) => {
	const root = rawBlogNodeSchema.safeParse(input);

	if (!root.success) {
		return false;
	}

	const pending = (root.data.content ?? []).map((value) => ({ depth: 0, value }));
	const resource = { count: 0, text: 0 };

	while (pending.length) {
		const frame = pending.pop();

		if (!frame) {
			break;
		}

		resource.count += 1;

		if (resource.count > 2000 || frame.depth > 12) {
			return false;
		}

		const node = rawBlogNodeSchema.safeParse(frame.value);

		if (!node.success) {
			return false;
		}

		resource.text += node.data.text?.length ?? 0;
		const children = node.data.content ?? [];

		if (resource.text > 250_000 || resource.count + pending.length + children.length > 2000) {
			return false;
		}

		children.forEach((value) => pending.push({ depth: frame.depth + 1, value }));
	}

	return true;
};

export const blogBodySchema = z
	.custom<z.input<typeof blogBodyStructureSchema>>()
	.superRefine((input, context) => {
		if (!hasBoundedBlogBody(input)) {
			context.addIssue({ code: "custom", message: "Article exceeds the depth, node, or text size limit" });
		}
	})
	.pipe(blogBodyStructureSchema);

z.globalRegistry.add(blogBodySchema, { id: "BlogBody" });

blogBodySchema._zod.toJSONSchema = () => ({
	...z.toJSONSchema(blogBodyStructureSchema),
	$id: "urn:starter:blog-body:v1",
});

export const blogLocaleContentSchema = z.object({
	body: blogBodySchema,
	coverAlt: z.string().max(500),
	excerpt: z.string().max(1000),
	seoDescription: z.string().max(500),
	seoTitle: z.string().max(200),
	title: z.string().max(200),
});

export const blogPostDocumentSchema = z
	.strictObject({
		ar: blogLocaleContentSchema,
		coverImage: z.strictObject({ src: blogUrlSchema }).nullable(),
		documentVersion: z.literal(1),
		en: blogLocaleContentSchema,
		translations: z
			.partialRecord(iso6391LanguageCodeSchema.exclude(["en", "ar"]), blogLocaleContentSchema)
			.optional(),
	})
	.meta({ id: "BlogPostDocument" });

export type BlogPostDocument = z.infer<typeof blogPostDocumentSchema>;

export type BlogPostLocaleContent = z.infer<typeof blogLocaleContentSchema>;

export type BlogBody = z.infer<typeof blogBodySchema>;

export const getBlogBodyText = (nodes: Array<BlogNode>): string =>
	nodes
		.map((node) => {
			if (node.type === "text") {
				return node.text;
			}

			if ("content" in node) {
				return getBlogBodyText(node.content ?? []);
			}

			return "";
		})
		.join(" ");

export const blogPublishDocumentSchema = blogPostDocumentSchema.superRefine((document, context) => {
	for (const locale of listBlogLocales(document)) {
		const copy = getBlogLocaleContent({ document, locale });

		if (!copy.title.trim() || !getBlogBodyText(copy.body.content).trim()) {
			context.addIssue({
				code: "custom",
				message: "Every language requires a title and article text",
				path: [locale],
			});
		}

		if (document.coverImage && !copy.coverAlt.trim()) {
			context.addIssue({
				code: "custom",
				message: "Describe the cover image in every language",
				path: [locale, "coverAlt"],
			});
		}
	}
});

export const createEmptyBlogPostDocument = (): BlogPostDocument => ({
	ar: {
		body: { content: [{ type: "paragraph" }], type: "doc" },
		coverAlt: "",
		excerpt: "",
		seoDescription: "",
		seoTitle: "",
		title: "",
	},
	coverImage: null,
	documentVersion: 1,
	en: {
		body: { content: [{ type: "paragraph" }], type: "doc" },
		coverAlt: "",
		excerpt: "",
		seoDescription: "",
		seoTitle: "",
		title: "",
	},
});

export type BlogPostSummary = {
	coverAlt: string;
	coverImage: { src: string } | null;
	excerpt: string;
	id: string;
	publishedAt: string;
	slug: string;
	title: string;
};

export const listBlogLocales = (document: BlogPostDocument) =>
	iso6391LanguageCodes.filter((locale) => locale === "en" || locale === "ar" || document.translations?.[locale]);

export const getBlogLocaleContent = ({
	document,
	fallbackLocale,
	locale,
}: {
	document: BlogPostDocument;
	fallbackLocale?: Iso6391LanguageCode;
	locale: Iso6391LanguageCode;
}): BlogPostLocaleContent => {
	const copy = locale === "en" || locale === "ar" ? document[locale] : document.translations?.[locale];

	if (copy) {
		return copy;
	}

	if (fallbackLocale) {
		const fallback =
			fallbackLocale === "en" || fallbackLocale === "ar"
				? document[fallbackLocale]
				: document.translations?.[fallbackLocale];

		return fallback ?? getBlogTranslationSource(document) ?? createEmptyBlogPostDocument().en;
	}

	return createEmptyBlogPostDocument().en;
};

export const setBlogLocaleContent = ({
	content,
	document,
	locale,
}: {
	content: BlogPostLocaleContent;
	document: BlogPostDocument;
	locale: Iso6391LanguageCode;
}): BlogPostDocument =>
	locale === "en" || locale === "ar"
		? { ...document, [locale]: content }
		: { ...document, translations: { ...document.translations, [locale]: content } };

export const getBlogTranslationSource = (document: BlogPostDocument) =>
	listBlogLocales(document)
		.map((locale) => getBlogLocaleContent({ document, locale }))
		.find((copy) => copy.title.trim() && getBlogBodyText(copy.body.content).trim());
