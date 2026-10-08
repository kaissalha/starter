import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
	blogBodySchema,
	blogPostDocumentSchema,
	blogPublishDocumentSchema,
	createEmptyBlogPostDocument,
	type BlogNode,
} from "../src/blog/blog-contracts";

describe("Blog document boundary", () => {
	it("resolves nested rich-text JSON Schema references in both languages", () => {
		const ajv = new Ajv2020({ strict: false });
		addFormats(ajv);
		const validate = ajv.compile(z.toJSONSchema(blogPostDocumentSchema, { io: "input" }));
		const document = createEmptyBlogPostDocument();

		for (const locale of ["en", "ar"] as const) {
			document[locale].body.content = [
				{
					content: [
						{
							content: [{ content: [{ text: "Nested article", type: "text" }], type: "paragraph" }],
							type: "listItem",
						},
					],
					type: "bulletList",
				},
			];
		}

		expect(validate(document)).toBe(true);

		for (const locale of ["en", "ar"] as const) {
			expect(
				validate({
					...document,
					[locale]: {
						...document[locale],
						body: { content: [{ attrs: { alt: "Invalid image", src: 42 }, type: "image" }], type: "doc" },
					},
				})
			).toBe(false);
		}
	});
	it("requires Tiptap-compatible block and list structure", () => {
		expect(blogBodySchema.safeParse({ content: [], type: "doc" }).success).toBe(false);

		for (const type of ["bulletList", "orderedList", "blockquote", "listItem"]) {
			expect(blogBodySchema.safeParse({ content: [{ type }], type: "doc" }).success).toBe(false);
			expect(blogBodySchema.safeParse({ content: [{ content: [], type }], type: "doc" }).success).toBe(false);
		}

		expect(
			blogBodySchema.safeParse({
				content: [
					{
						content: [{ content: [{ attrs: { level: 2 }, type: "heading" }], type: "listItem" }],
						type: "bulletList",
					},
				],
				type: "doc",
			}).success
		).toBe(false);
	});

	it("accepts incomplete drafts while requiring bilingual text for publication", () => {
		const document = createEmptyBlogPostDocument();
		expect(blogPostDocumentSchema.safeParse(document).success).toBe(true);
		expect(blogPublishDocumentSchema.safeParse(document).success).toBe(false);
		document.en.title = "Article";
		document.ar.title = "المقال";
		document.en.body.content = [{ content: [{ text: "Article content", type: "text" }], type: "paragraph" }];
		document.ar.body.content = [{ content: [{ text: "محتوى المقال", type: "text" }], type: "paragraph" }];
		expect(blogPublishDocumentSchema.safeParse(document).success).toBe(true);
	});
	it("rejects extremely deep and cyclic structures before recursive Zod parsing", () => {
		const deep = Array.from({ length: 20_000 }).reduce<Array<BlogNode>>(
			(content) => [{ content, type: "blockquote" }],
			[{ type: "paragraph" }]
		);

		expect(() => blogBodySchema.safeParse({ content: deep, type: "doc" })).not.toThrow();
		expect(blogBodySchema.safeParse({ content: deep, type: "doc" }).success).toBe(false);
		const content: Array<BlogNode> = [];
		content.push({ content, type: "blockquote" });
		expect(() => blogBodySchema.safeParse({ content, type: "doc" })).not.toThrow();
		expect(blogBodySchema.safeParse({ content, type: "doc" }).success).toBe(false);
	});
	it("bounds aggregate nodes and text before parsing", () => {
		const nodes = Array.from({ length: 500 }, () => ({
			content: Array.from({ length: 5 }, () => ({ text: "Text", type: "text" })),
			type: "paragraph",
		}));

		expect(blogBodySchema.safeParse({ content: nodes, type: "doc" }).success).toBe(false);

		const text = Array.from({ length: 6 }, () => ({
			content: [{ text: "a".repeat(50_000), type: "text" }],
			type: "paragraph",
		}));

		expect(blogBodySchema.safeParse({ content: text, type: "doc" }).success).toBe(false);
	});
	it("rejects unsupported nodes, invalid nesting, and unsafe image and link URLs", () => {
		expect(
			blogBodySchema.safeParse({
				content: [{ attrs: { src: "https://example.com" }, type: "iframe" }],
				type: "doc",
			}).success
		).toBe(false);
		expect(
			blogBodySchema.safeParse({ content: [{ text: "Top-level text", type: "text" }], type: "doc" }).success
		).toBe(false);

		for (const src of [
			"javascript:alert(1)",
			" https://example.com/image.jpg",
			"https://example.com/\nimage.jpg",
			String.raw`https://example.com/\image.jpg`,
			"/image\t.jpg",
			"data:image/svg+xml,unsafe",
			"//example.com/image.jpg",
			"https://user:password@example.com/image.jpg",
		]) {
			expect(
				blogBodySchema.safeParse({ content: [{ attrs: { alt: "Image", src }, type: "image" }], type: "doc" })
					.success
			).toBe(false);
		}

		expect(
			blogBodySchema.safeParse({
				content: [
					{
						content: [
							{
								marks: [{ attrs: { href: "javascript:alert(1)" }, type: "link" }],
								text: "Link",
								type: "text",
							},
						],
						type: "paragraph",
					},
				],
				type: "doc",
			}).success
		).toBe(false);
	});
});

it("validates additional blog languages and preserves existing content", () => {
	const document = createEmptyBlogPostDocument();

	const french = {
		...document.en,
		body: {
			content: [{ content: [{ text: "Un article.", type: "text" as const }], type: "paragraph" as const }],
			type: "doc" as const,
		},
		title: "Bonjour",
	};

	const translated = blogPostDocumentSchema.parse({ ...document, translations: { fr: french } });
	expect(translated.translations?.fr).toEqual(french);
	expect(translated.en).toEqual(document.en);
	expect(blogPostDocumentSchema.parse({ ...document, en: { ...document.en, categories: ["News"] } }).en).toEqual(
		document.en
	);
	expect(blogPostDocumentSchema.safeParse({ ...document, translations: { invalid: french } }).success).toBe(false);
	expect(blogPostDocumentSchema.safeParse({ ...document, translations: { en: french } }).success).toBe(false);
});
