import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { createEmptyBlogPostDocument, type BlogPostSummary } from "../src/blog/blog-contracts";
import { BlogFeedSection } from "../src/blog/blog-feed-section";
import { withBlogNavigation } from "../src/blog/blog-navigation";
import { BlogArticle } from "../src/blog/blog-renderer";
import { validateSiteDocument } from "../src/document/document-validation";
import { editWebsiteSnapshot } from "../src/document/edit-website";
import { SitePreviewRenderer } from "../src/rendering/site-preview-renderer";
import { SiteRenderer } from "../src/rendering/site-renderer";
import { WebsiteLanguageSwitcher } from "../src/rendering/website-language-switcher";
import { blogLatestThreeSection } from "../src/sections/content/blog-latest";
import { blogListSection } from "../src/sections/content/blog-list";
import { blogPortraitGridSection } from "../src/sections/content/blog-portrait-grid";
import { entityIdFromSeed } from "../src/sections/entity-id";
import { instantiateSection } from "../src/sections/section-definition";
import { nordicEdgeTemplate } from "../src/templates/nordic-edge";
import content from "../src/templates/nordic-edge/content.json";
import { instantiateTemplate } from "../src/templates/template-definition";
import { testBrand } from "./fixtures/brand";

const website = () =>
	instantiateTemplate({
		content,
		createId: ({ kind, path }) => entityIdFromSeed({ seed: `blog-test:${kind}:${path}` }),
		definition: nordicEdgeTemplate,
		path: "/blog-test",
	});

const posts: Array<BlogPostSummary> = Array.from({ length: 7 }, (_, index) => ({
	coverAlt: "",
	coverImage: null,
	excerpt: "",
	id: `post-${index}`,
	publishedAt: "2026-01-01T00:00:00.000Z",
	slug: `article-${index}`,
	title: `Article ${index}`,
}));

describe("public blog rendering", () => {
	it("allows an editor cover control without changing the public cover", () => {
		const document = createEmptyBlogPostDocument();
		document.coverImage = { src: "https://example.com/cover.jpg" };
		document.en.coverAlt = "Cover description";
		const published = renderToStaticMarkup(<BlogArticle document={document} locale='en' />);

		const editing = renderToStaticMarkup(
			<BlogArticle coverContent={<button type='button'>Edit cover</button>} document={document} locale='en' />
		);

		expect(published).toContain('alt="Cover description"');
		expect(editing).toContain("Edit cover");
		expect(editing).not.toContain("cover.jpg");
	});
	it("adds localized Blog navigation without changing the saved document or duplicating links", () => {
		const document = website();
		const saved = structuredClone(document);
		const projected = withBlogNavigation(document);
		expect(document).toEqual(saved);
		expect(projected).not.toBe(document);
		expect(withBlogNavigation(projected)).toBe(projected);
		expect(validateSiteDocument(projected)).toMatchObject({ success: true });

		for (const locale of ["en", "ar"] as const) {
			const html = renderToStaticMarkup(
				<SiteRenderer
					basePath={locale === "ar" ? "/ar" : undefined}
					brand={testBrand}
					document={projected}
					locale={locale}
				/>
			);

			expect(html).toContain(locale === "ar" ? "المدونة" : ">Blog<");
			expect(html).toMatch(/text-current[^>]*>Blog<|text-current[^>]*>المدونة</u);
			expect(html).toContain(`href="${locale === "ar" ? "/ar" : ""}/blog"`);
		}
	});

	it("persists Blog visibility while retaining a recoverable editor link", () => {
		const document = website();
		const snapshot = { brand: testBrand, document };

		const hidden = editWebsiteSnapshot({
			input: { operation: "set-blog-navigation", visible: false },
			snapshot,
		});

		expect(withBlogNavigation(hidden.document)).toBe(hidden.document);
		expect(withBlogNavigation(hidden.document, { includeHidden: true })).not.toBe(hidden.document);
		expect(document.blogNavigationHidden).toBeUndefined();

		const restored = editWebsiteSnapshot({
			input: { operation: "set-blog-navigation", visible: true },
			snapshot: hidden,
		});

		expect(withBlogNavigation(restored.document)).not.toBe(restored.document);
	});

	it("renders the strict editor document statically, escapes text and preserves Arabic direction", () => {
		const document = createEmptyBlogPostDocument();
		document.ar.title = "عنوان المقال";
		document.ar.body = {
			content: [
				{
					attrs: { level: 2 },
					content: [{ text: "<script>alert(1)</script>", type: "text" }],
					type: "heading",
				},
				{
					content: [
						{
							marks: [
								{ type: "bold" },
								{ type: "italic" },
								{ attrs: { href: "https://example.com", target: "_blank" }, type: "link" },
							],
							text: "رابط",
							type: "text",
						},
					],
					type: "paragraph",
				},
				{
					attrs: { start: 3 },
					content: [
						{
							content: [{ content: [{ text: "عنصر", type: "text" }], type: "paragraph" }],
							type: "listItem",
						},
					],
					type: "orderedList",
				},
			],
			type: "doc",
		};
		const html = renderToStaticMarkup(<BlogArticle document={document} locale='ar' />);
		expect(html).toContain('dir="rtl"');
		expect(html).toContain('lang="ar"');
		expect(html).toContain("&lt;script&gt;");
		expect(html).not.toContain("<script>");
		expect(html).toContain("<strong>");
		expect(html).toContain("<em>");
		expect(html).toContain('rel="noopener noreferrer"');
		expect(html).toContain('start="3"');
		expect(html).not.toContain("contenteditable");
	});
	it("uses the website shell around an article and omits home-page content", () => {
		const document = website();

		const html = renderToStaticMarkup(
			<SiteRenderer brand={testBrand} document={document} pageContent={<article>Blog body</article>} />
		);

		expect(html).toContain("website-container");
		expect(html).toContain("--website-font-brand");
		expect(html).toContain("<article>Blog body</article>");

		for (const section of [...document.structure.layout.header, ...document.structure.layout.footer]) {
			expect(html).toContain(`id="${section.id}"`);
		}

		for (const section of document.structure.pages[0]?.sections ?? []) {
			expect(html).not.toContain(`id="${section.id}"`);
		}
	});
	it("hides an empty public feed, shows its editor placeholder and caps localized links at three", () => {
		const document = website();

		const feed = instantiateSection({
			anchor: "latest-posts",
			content: {
				ar: { copy: { empty: "لا توجد مقالات", heading: "المقالات" } },
				en: { copy: { empty: "Publish a post to fill this section", heading: "Latest posts" } },
			},
			createId: ({ kind, path }) => entityIdFromSeed({ seed: `feed:${kind}:${path}` }),
			defaultLocale: "en",
			definition: blogLatestThreeSection,
			path: "/feed",
		});

		for (const locale of ["en", "ar"] as const) {
			const localized = document.content[locale];
			const copy = feed.content[locale];

			if (!localized || !copy) {
				throw new Error("Missing locale fixture");
			}

			localized.sections[feed.section.contentId] = copy;
		}

		const props = { document, linkComponent: "a" as const, locale: "en" as const, section: feed.section };
		expect(renderToStaticMarkup(<BlogFeedSection {...props} />)).toBe("");
		expect(renderToStaticMarkup(<BlogFeedSection {...props} preview />)).toContain("Publish a post");
		const html = renderToStaticMarkup(<BlogFeedSection {...props} basePath='/ar' locale='ar' posts={posts} />);
		expect(html).toContain("/ar/blog/article-2");
		expect(html).not.toContain("/ar/blog/article-3");
		expect(html).toContain(`id="${feed.section.id}"`);
	});
});

describe("blog layout sections", () => {
	it("renders the heading tree with host-rendered posts and hides when empty", () => {
		const actions = { actions: [{ label: "All", link: { kind: "relative", path: "/blog" } }] };

		for (const definition of [blogListSection, blogPortraitGridSection]) {
			const section = instantiateSection({
				anchor: "journal",
				content: {
					ar: {
						copy: { description: "وصف", empty: "فارغ", heading: "عنوان" },
						...(definition === blogPortraitGridSection && actions),
					},
					en: {
						copy: { description: "About", empty: "Nothing yet", heading: "Journal" },
						...(definition === blogPortraitGridSection && actions),
					},
				},
				createId: ({ kind, path }) =>
					entityIdFromSeed({ seed: `layout:${definition.pattern}:${kind}:${path}` }),
				defaultLocale: "en",
				definition,
				path: "/layout",
			});

			const base = website();

			for (const locale of ["en", "ar"] as const) {
				const copy = section.content[locale];
				const localized = base.content[locale];

				if (!copy || !localized) {
					throw new Error("Missing locale fixture");
				}

				localized.sections[section.section.contentId] = copy;
			}

			const document = {
				...base,
				structure: {
					...base.structure,
					pages: [
						{
							...base.structure.pages[0]!,
							sections: [...base.structure.pages[0]!.sections, section.section],
						},
					],
				},
			};

			const empty = renderToStaticMarkup(<SiteRenderer brand={testBrand} document={document} />);
			expect(empty).not.toContain("Journal");
			const html = renderToStaticMarkup(<SiteRenderer blogPosts={posts} brand={testBrand} document={document} />);
			expect(html).toContain("Journal");
			expect(html).toContain("/blog/article-0");
		}
	});
});

describe("published site landmarks", () => {
	it("wraps sections in header, a single main and footer behind a localized skip link", () => {
		const document = website();
		const html = renderToStaticMarkup(<SiteRenderer brand={testBrand} document={document} />);
		expect(html).toContain('<main class="contents" id="main"');
		expect(html).toContain('href="#main"');
		expect(html).toContain("Skip to main content");
		expect(html.match(/<main\b/gu)).toHaveLength(1);
		expect(html.indexOf("<header")).toBeGreaterThan(-1);
		expect(html.indexOf("<header")).toBeLessThan(html.indexOf("<main"));
		expect(html.indexOf("<main")).toBeLessThan(html.indexOf("<footer"));
		expect(renderToStaticMarkup(<SiteRenderer brand={testBrand} document={document} locale='ar' />)).toContain(
			"انتقل إلى المحتوى الرئيسي"
		);

		const article = renderToStaticMarkup(
			<SiteRenderer brand={testBrand} document={document} pageContent={<article>Blog body</article>} />
		);

		expect(article.match(/<main\b/gu)).toHaveLength(1);
		expect(article).toMatch(/<main[^>]*id="main"[^>]*><article>Blog body<\/article><\/main>/u);

		for (const section of [...document.structure.layout.header, ...document.structure.layout.footer]) {
			expect(article).toContain(`id="${section.id}"`);
		}

		const preview = renderToStaticMarkup(
			<SitePreviewRenderer
				brand={testBrand}
				document={document}
				sectionComponent={({ children }) => <>{children}</>}
			/>
		);

		expect(preview).not.toContain("<main");
		expect(preview).not.toContain('href="#main"');
	});

	it("hides the language switcher without an alternative language", () => {
		const english = { href: "/", label: "English", locale: "en" as const };
		expect(renderToStaticMarkup(<WebsiteLanguageSwitcher links={[english]} locale='en' />)).toBe("");

		const html = renderToStaticMarkup(
			<WebsiteLanguageSwitcher links={[english, { href: "/ar", label: "العربية", locale: "ar" }]} locale='en' />
		);

		expect(html).toContain("<nav");
		expect(html).toContain('hrefLang="ar"');
	});
});
