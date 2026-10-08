import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { brandFoundationSchema } from "@starter/infinite-brand";

import {
	applyLinkPageTheme,
	createDefaultLinkPageDocument,
	defaultLinkPageBrand,
	defaultLinkPageSectionAppearance,
	LinkPageRenderer,
	linkPageDocumentSchema,
	linkPageProfileLayouts,
	linkPageLinkDesigns,
	linkPageThemes,
	resolveLinkPageBrand,
	resolveLinkPageCopy,
	resolveLinkPageRedirect,
	resolveYouTubeVideoId,
	type LinkPageDocument,
	type LinkPageLink,
} from "../src";
import { LinkPageRichText } from "../src/link-page-rich-text";

type LinkPageBlock = LinkPageDocument["blocks"][number];

const linkId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d";

const otherId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32e";

const thirdId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32f";

const socialBlockId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330";

const socialId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d331";

const createLink = (overrides: Partial<LinkPageLink> = {}): LinkPageLink => ({
	appearance: defaultLinkPageSectionAppearance,
	enabled: true,
	id: linkId,
	kind: "link",
	label: { ar: "احجز مكالمة", en: "Book a call" },
	layout: "classic",
	url: "https://example.com/book",
	...overrides,
});

describe("links page contract", () => {
	it.each(linkPageProfileLayouts)("shows the business logo in the %s profile without a custom image", (layout) => {
		const logo = { scale: 1, src: "https://store.public.blob.vercel-storage.com/logo.png" };
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		document.profile.layout = layout;

		const render = (imageUrl: string | null) =>
			renderToStaticMarkup(
				<LinkPageRenderer
					brand={{ ...defaultLinkPageBrand, logo }}
					document={{ ...document, profile: { ...document.profile, imageUrl } }}
					locale='en'
				/>
			);

		expect(render(null)).toContain(`data-links-profile-logo="" loading="eager" src="${logo.src}"`);
		expect(render("https://example.com/me.jpg")).not.toContain("data-links-profile-logo");
	});

	it("renders saved soft buttons as solid buttons", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		document.blocks = [createLink()];
		document.appearance.buttons = {
			colors: { button: "#fff7ce", shadow: null, text: "#eb8201" },
			shadow: "none",
			style: "soft",
		};

		const legacy = renderToStaticMarkup(
			<LinkPageRenderer brand={defaultLinkPageBrand} document={document} locale='en' />
		);

		document.appearance.buttons.style = "solid";
		expect(
			renderToStaticMarkup(<LinkPageRenderer brand={defaultLinkPageBrand} document={document} locale='en' />)
		).toBe(legacy);
	});

	it("inherits the overall layout and restores it when a section override is removed", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		document.appearance.buttons.design = "cards-01";

		const collection = {
			appearance: { ...defaultLinkPageSectionAppearance },
			display: "stack" as const,
			enabled: true,
			id: otherId,
			kind: "collection" as const,
			links: [createLink()],
			title: {},
		};

		document.blocks = [collection];

		const render = () =>
			renderToStaticMarkup(
				<LinkPageRenderer
					brand={defaultLinkPageBrand}
					document={linkPageDocumentSchema.parse(document)}
					locale='en'
				/>
			);

		expect(render()).toContain('data-links-collection-design="cards-01"');
		collection.appearance.buttons = { ...document.appearance.buttons, design: "buttons-02" };
		expect(render()).toContain('data-links-collection-design="buttons-02"');
		collection.appearance.buttons = { ...document.appearance.buttons, design: undefined };
		expect(render()).not.toContain("data-links-collection-design");
		collection.appearance.buttons = null;
		expect(render()).toContain('data-links-collection-design="cards-01"');
	});
	it.each(["/", "/about", "/ar/القائمة", "/contact?from=links#form"])("renders same-domain target %s", (url) => {
		const document = linkPageDocumentSchema.parse({
			...createDefaultLinkPageDocument({ name: "Northstar" }),
			blocks: [createLink({ url })],
		});

		const html = renderToStaticMarkup(
			<LinkPageRenderer brand={defaultLinkPageBrand} document={document} locale='en' />
		);

		expect(html).toContain(`href="${url}"`);
		expect(resolveLinkPageRedirect({ document: { ...document, redirectBlockId: linkId } })).toBe(url);
	});
	it.each(["//evil.example", String.raw`/\evil.example`, "/about\n/evil", "javascript:alert(1)", "about"])(
		"rejects unsafe or ambiguous target %s",
		(url) => {
			expect(
				linkPageDocumentSchema.safeParse({
					...createDefaultLinkPageDocument({ name: "Northstar" }),
					blocks: [createLink({ url })],
				}).success
			).toBe(false);
		}
	);

	it("renders localized enabled blocks with the shared Brand", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		document.blocks.push(
			createLink(),
			{
				appearance: defaultLinkPageSectionAppearance,
				enabled: true,
				id: otherId,
				kind: "header",
				text: { en: "Latest" },
			},
			{
				appearance: defaultLinkPageSectionAppearance,
				enabled: true,
				id: thirdId,
				kind: "video",
				title: {},
				url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			},
			{
				appearance: defaultLinkPageSectionAppearance,
				enabled: true,
				id: socialBlockId,
				items: [{ id: socialId, platform: "instagram", url: "https://instagram.com/northstar" }],
				kind: "socials",
			}
		);

		const html = renderToStaticMarkup(
			<LinkPageRenderer brand={defaultLinkPageBrand} document={document} locale='ar' />
		);

		expect(html).toContain('dir="rtl"');
		expect(html).toContain("website-container");
		expect(html).toContain("احجز مكالمة");
		expect(html).toContain('href="https://example.com/book"');
		expect(html).toContain("Latest");
		expect(html).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
		expect(html).toContain('aria-label="Instagram"');
	});

	it("keeps the hero profile distinct from classic without uploaded media", () => {
		const classicDocument = createDefaultLinkPageDocument({ name: "Northstar" });

		const heroDocument: LinkPageDocument = {
			...classicDocument,
			profile: { ...classicDocument.profile, layout: "hero" },
		};

		const classicHtml = renderToStaticMarkup(
			<LinkPageRenderer brand={defaultLinkPageBrand} document={classicDocument} locale='en' />
		);

		const heroHtml = renderToStaticMarkup(
			<LinkPageRenderer brand={defaultLinkPageBrand} document={heroDocument} locale='en' />
		);

		expect(classicHtml).toContain('data-links-profile-layout="classic"');
		expect(classicHtml).not.toContain("data-links-profile-hero");
		expect(heroHtml).toContain('data-links-profile-layout="hero"');
		expect(heroHtml).toContain('data-links-profile-hero=""');
	});

	it("keeps the profile image as an avatar in the hero layout", () => {
		const document = createDefaultLinkPageDocument({
			imageUrl: "https://example.com/avatar.jpg",
			name: "Northstar",
		});

		document.profile.layout = "hero";

		const html = renderToStaticMarkup(
			<LinkPageRenderer brand={defaultLinkPageBrand} document={document} locale='en' />
		);

		expect(html).toContain('data-links-profile-hero=""');
		expect(html).toContain('class="size-24 rounded-full');
		expect(html.match(/src="https:\/\/example.com\/avatar.jpg"/gu)).toHaveLength(1);
	});

	it.each(linkPageProfileLayouts)(
		"keeps %s headers localized and decorative titles outside editable text",
		(layout) => {
			const document = createDefaultLinkPageDocument({
				imageUrl: "https://example.com/portrait.jpg",
				name: "Northstar",
			});

			document.profile = {
				...document.profile,
				bannerUrl: "https://example.com/cover.jpg",
				layout,
				title: { ar: "نور", en: "Northstar" },
			};
			document.blocks = [createLink()];
			document.headerBlockIds = [linkId];
			const parsed = linkPageDocumentSchema.parse(structuredClone(document));

			const html = renderToStaticMarkup(
				<LinkPageRenderer
					brand={defaultLinkPageBrand}
					document={parsed}
					locale='ar'
					preview
					textElementProps={(target) =>
						target.kind === "profile" && target.field === "title"
							? { "data-editable-title": "" }
							: undefined
					}
				/>
			);

			expect(html).toContain('dir="rtl"');
			expect(html).toMatch(/<h1[^>]*data-editable-title=""[^>]*>نور<\/h1>/u);
			expect(html.match(/<h1/gu)).toHaveLength(1);
			expect(html.match(/احجز مكالمة/gu)).toHaveLength(1);
			expect(html).toContain('src="https://example.com/portrait.jpg"');
			expect(parsed.profile.bannerUrl).toBe("https://example.com/cover.jpg");
		}
	);

	it("renders liinks dividers, bottom socials and the desktop column frame", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		document.profile.layout = "centered";
		document.blocks = [
			{
				appearance: defaultLinkPageSectionAppearance,
				enabled: true,
				id: socialBlockId,
				items: [{ id: socialId, platform: "instagram", url: "https://instagram.com/northstar" }],
				kind: "socials",
			},
			createLink(),
		];
		document.headerBlockIds = [socialBlockId];
		document.appearance = {
			...document.appearance,
			divider: { rule: "double", ruleWidth: 0, size: 0.5, spaceAbove: 0.375, spaceBelow: 0.375 },
			socialsAtBottom: true,
			wallpaper: { ...document.appearance.wallpaper, color: "#123456", desktopColor: "#00502f", style: "fill" },
		};

		const html = renderToStaticMarkup(
			<LinkPageRenderer
				brand={defaultLinkPageBrand}
				document={linkPageDocumentSchema.parse(document)}
				locale='en'
			/>
		);

		expect(html).toContain("--lp-divider-size:24px");
		expect(html).toContain("--lp-divider-rule:3px double currentColor");
		expect(html).toContain("background-color:#00502f");
		expect(html).toMatch(/data-links-column=""[^>]*style="background-color:#123456/u);
		expect(html).not.toContain("data-links-header-blocks");
		expect(html.indexOf("Book a call")).toBeGreaterThan(-1);
		expect(html.indexOf("Book a call")).toBeLessThan(html.indexOf("instagram.com/northstar"));
	});

	it.each(Object.values(linkPageLinkDesigns).flat())(
		"persists %s collections and renders image, localized description and enabled links",
		(design) => {
			const document = createDefaultLinkPageDocument({ name: "Northstar" });
			document.blocks = [
				{
					appearance: defaultLinkPageSectionAppearance,
					design,
					display: "stack",
					enabled: true,
					id: otherId,
					kind: "collection",
					links: [
						createLink({
							description: { ar: "تفاصيل الحجز", en: "Booking details" },
							imageUrl: "https://example.com/card.jpg",
						}),
						createLink({ enabled: false, id: thirdId, label: { en: "Hidden" } }),
					],
					title: {},
				},
			];
			document.appearance.buttons.showImages = true;
			const parsed = linkPageDocumentSchema.parse(structuredClone(document));

			const html = renderToStaticMarkup(
				<LinkPageRenderer brand={defaultLinkPageBrand} document={parsed} locale='ar' />
			);

			const hidden = renderToStaticMarkup(
				<LinkPageRenderer
					brand={defaultLinkPageBrand}
					document={{
						...parsed,
						appearance: {
							...parsed.appearance,
							buttons: { ...parsed.appearance.buttons, showImages: false },
						},
					}}
					locale='ar'
				/>
			);

			expect(html).toContain(`data-links-collection-design="${design}"`);
			expect(html).toContain('src="https://example.com/card.jpg"');
			expect(hidden).not.toContain('src="https://example.com/card.jpg"');
			expect(hidden).toContain("تفاصيل الحجز");
			expect(html).toContain("تفاصيل الحجز");
			expect(html.match(/href="https:\/\/example.com\/book"/gu)).toHaveLength(1);
			expect(html).not.toContain("Hidden");
		}
	);

	it("rejects unsafe image URLs and unsupported designs", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		expect(
			linkPageDocumentSchema.safeParse({
				...document,
				profile: { ...document.profile, bannerUrl: "javascript:alert(1)" },
			}).success
		).toBe(false);
		expect(
			linkPageDocumentSchema.safeParse({
				...document,
				blocks: [createLink({ imageUrl: "data:image/svg+xml,<svg/>" })],
			}).success
		).toBe(false);
		expect(
			linkPageDocumentSchema.safeParse({ ...document, blocks: [{ ...createLink(), design: "unrecognized" }] })
				.success
		).toBe(false);
	});

	it("hides disabled blocks and uses thumbnails in preview mode", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		document.blocks.push(createLink({ enabled: false }), {
			appearance: defaultLinkPageSectionAppearance,
			enabled: true,
			id: otherId,
			kind: "video",
			title: { en: "Intro" },
			url: "https://youtu.be/dQw4w9WgXcQ",
		});

		const html = renderToStaticMarkup(
			<LinkPageRenderer brand={defaultLinkPageBrand} document={document} locale='en' preview />
		);

		expect(html).not.toContain("Book a call");
		expect(html).toContain("i.ytimg.com/vi/dQw4w9WgXcQ");
		expect(html).not.toContain("<iframe");
	});

	it("exposes editable copy targets without changing public markup by default", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		document.blocks.push(createLink());
		const targets: Array<string> = [];

		const html = renderToStaticMarkup(
			<LinkPageRenderer
				brand={defaultLinkPageBrand}
				document={document}
				locale='en'
				preview
				textElementProps={(target) => {
					targets.push(`${target.kind}:${target.field}`);

					return { "data-inline-target": `${target.kind}:${target.field}` };
				}}
			/>
		);

		expect(targets).toEqual(expect.arrayContaining(["profile:title", "profile:bio", "block:label"]));
		expect(html).toContain('data-inline-target="block:label"');

		const publicHtml = renderToStaticMarkup(
			<LinkPageRenderer brand={defaultLinkPageBrand} document={document} locale='en' />
		);

		expect(publicHtml).not.toContain("data-inline-target");
	});

	it("exposes profile, block and insertion controls only when an editor provides them", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		document.blocks.push(createLink({ enabled: false }));
		document.headerBlockIds.push(linkId);
		const controls: Array<string> = [];
		const insertions: Array<string> = [];

		const html = renderToStaticMarkup(
			<LinkPageRenderer
				brand={defaultLinkPageBrand}
				document={document}
				locale='en'
				preview
				renderBlockControls={(block) => {
					controls.push(block.id);

					return <span data-block-controls={block.id} />;
				}}
				renderInsertionControl={({ index, placement }) => {
					insertions.push(`${placement}:${index}`);

					return <span data-insertion={`${placement}:${index}`} />;
				}}
				renderProfileControls={() => <span data-profile-controls='' />}
			/>
		);

		expect(controls).toEqual([linkId]);
		expect(insertions).toEqual(["header:0", "header:1", "page:0"]);
		expect(html).toContain("Book a call");
		expect(html).toContain(`data-block-controls="${linkId}"`);
		expect(html).toContain('data-links-profile=""');
		expect(html).toContain('data-profile-controls=""');
		expect(html).not.toContain("hover:outline-[var(--color-selection)]");
		expect(html).toContain('data-insertion="header:0"');
		expect(html.match(/group\/links-insertion/gu)).toHaveLength(3);
	});

	it("rejects unsafe URLs, non-YouTube videos and duplicate block identities", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });

		expect(
			linkPageDocumentSchema.safeParse({ ...document, blocks: [createLink({ url: "javascript:alert(1)" })] })
				.success
		).toBe(false);
		expect(
			linkPageDocumentSchema.safeParse({
				...document,
				blocks: [createLink(), createLink({ url: "https://example.com/two" })],
			}).success
		).toBe(false);
		expect(
			linkPageDocumentSchema.safeParse({
				...document,
				blocks: [
					createLink(),
					{
						appearance: defaultLinkPageSectionAppearance,
						display: "grid",
						enabled: true,
						id: otherId,
						kind: "collection",
						links: [createLink({ url: "https://example.com/nested" })],
						title: {},
					},
				],
			}).success
		).toBe(false);
		expect(
			linkPageDocumentSchema.safeParse({
				...document,
				blocks: [
					{
						appearance: defaultLinkPageSectionAppearance,
						enabled: true,
						id: linkId,
						kind: "video",
						title: {},
						url: "https://vimeo.com/1",
					},
				],
			}).success
		).toBe(false);
		expect(linkPageDocumentSchema.safeParse({ ...document, headerBlockIds: [linkId] }).success).toBe(false);
		expect(
			linkPageDocumentSchema.safeParse({
				...document,
				blocks: [createLink()],
				headerBlockIds: [linkId, linkId],
			}).success
		).toBe(false);
		expect(linkPageDocumentSchema.safeParse({ ...document, redirectBlockId: linkId }).success).toBe(false);
		expect(
			linkPageDocumentSchema.safeParse({
				...document,
				blocks: [
					{
						appearance: defaultLinkPageSectionAppearance,
						enabled: true,
						id: socialBlockId,
						items: [{ id: socialId, platform: "whatsapp", url: "tel:(   )" }],
						kind: "socials",
					},
				],
			}).success
		).toBe(false);
	});

	it("parses YouTube identifiers from every common URL shape", () => {
		expect(resolveYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1s")).toBe("dQw4w9WgXcQ");
		expect(resolveYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
		expect(resolveYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
		expect(resolveYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
		expect(resolveYouTubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
	});

	it("applies page-specific Brand overrides without mutating the inherited Brand", () => {
		const brand = resolveLinkPageBrand({
			brandOverride: { colors: { primary: "#ff0000" }, cornerStyle: "square" },
			inheritedBrand: defaultLinkPageBrand,
		});

		expect(brand.colors.primary).toBe("#ff0000");
		expect(brand.corners.style).toBe("square");
		expect(defaultLinkPageBrand.colors.primary).toBe("#6857d4");
	});

	it.each(linkPageThemes.slice(0, 3))(
		"persists and renders the $id theme with coordinated typography and corners while preserving content",
		(theme) => {
			const original = createDefaultLinkPageDocument({ name: "Northstar" });
			original.appearance.brandOverride = { cornerStyle: "square", fontPairingId: "editorial" };
			original.profile.layout = "bold-01";
			original.appearance.buttons.design = "buttons-02";
			original.blocks = [createLink({ design: "cards-02" })];
			const document = linkPageDocumentSchema.parse(applyLinkPageTheme({ document: original, theme }));

			const brand = resolveLinkPageBrand({
				brandOverride: document.appearance.brandOverride,
				inheritedBrand: defaultLinkPageBrand,
			});

			const html = renderToStaticMarkup(<LinkPageRenderer brand={brand} document={document} locale='ar' />);
			expect(document.profile).toEqual({ ...original.profile, layout: theme.headerLayout });
			expect(document.appearance.buttons.design).toBe(theme.buttons.design);
			expect(document.blocks).toEqual(original.blocks);
			expect(document.appearance.brandOverride).toMatchObject({
				cornerStyle: theme.cornerStyle,
				fontPairingId: theme.fontPairingId,
			});
			expect(brand.corners.style).toBe(theme.cornerStyle);
			expect(original.appearance.themeId).toBeNull();
			expect(html).toContain(`--foreground-primary:${theme.colors.neutral}`);
			expect(html).toContain(`--surface-canvas:${theme.colors.background}`);
			expect(html).toContain(`--lp-button-text:${theme.buttons.colors.text}`);
			expect(html).toContain(
				(theme.buttons.effect ?? "none") === "none"
					? `${theme.buttons.opacity}%, transparent)`
					: "--lp-button-fill:"
			);
			expect(html.includes("data-links-animated-wallpaper")).toBe(
				theme.wallpaper.animation !== undefined || theme.banner?.animation !== undefined
			);
			expect(html).toContain('dir="rtl"');
			expect(html).toContain("احجز مكالمة");
		}
	);

	it("renders link badges, collapsible collections, labelled socials and split wallpapers", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		document.appearance.wallpaper = { ...document.appearance.wallpaper, style: "split" };
		document.blocks = [
			{
				appearance: defaultLinkPageSectionAppearance,
				collapsible: true,
				display: "stack",
				enabled: true,
				id: otherId,
				kind: "collection",
				links: [createLink({ badge: { en: "15% off" } })],
				title: { en: "Our services" },
			},
			{
				appearance: defaultLinkPageSectionAppearance,
				display: "chips",
				enabled: true,
				id: thirdId,
				items: [{ id: crypto.randomUUID(), platform: "instagram", url: "https://instagram.com/northstar" }],
				kind: "socials",
			},
		];
		const parsed = linkPageDocumentSchema.parse(structuredClone(document));

		const html = renderToStaticMarkup(
			<LinkPageRenderer brand={defaultLinkPageBrand} document={parsed} locale='en' />
		);

		expect(html).toContain("<details");
		expect(html).toContain("Our services");
		expect(html).toContain("15% off");
		expect(html).toContain("Instagram</a>");
		expect(html).toContain("linear-gradient(155deg");
	});

	it.each([-1, 101, Number.NaN])("rejects invalid button opacity %s", (opacity) => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		document.appearance.buttons.opacity = opacity;
		expect(linkPageDocumentSchema.safeParse(document).success).toBe(false);
	});

	it("rejects CSS injection in custom gradient colours", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		document.appearance.wallpaper.gradientColors = ["#ffffff", "url(https://example.com/track)", "#000000"];
		expect(linkPageDocumentSchema.safeParse(document).success).toBe(false);
	});

	it("renders header and section design overrides independently", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		document.appearance.header = {
			backgroundColor: "#112233",
			foregroundColor: "#ffffff",
			style: "band",
		};
		document.blocks.push(
			createLink({
				appearance: {
					alignment: "center",
					backgroundColor: "#445566",
					buttons: {
						colors: { button: "#abcdef", shadow: "#010203", text: "#102030" },
						shadow: "hard",
						style: "outline",
					},
					foregroundColor: "#fedcba",
					style: "card",
				},
			})
		);

		const html = renderToStaticMarkup(
			<LinkPageRenderer brand={defaultLinkPageBrand} document={document} locale='en' />
		);

		expect(html).toContain('data-links-section-style="band"');
		expect(html).toContain('data-links-section-style="card"');
		expect(html).toContain("background-color:#112233");
		expect(html).toContain("background-color:#445566");
		expect(html).toContain("--lp-button:#abcdef");
		expect(html).toContain("--lp-button-shadow:#010203");
	});

	it("renders linked sections inside the profile header without duplicating them", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		document.blocks.push(createLink(), {
			appearance: defaultLinkPageSectionAppearance,
			enabled: true,
			id: socialBlockId,
			items: [{ id: socialId, platform: "instagram", url: "https://instagram.com/northstar" }],
			kind: "socials",
		});
		document.headerBlockIds = [socialBlockId];

		const html = renderToStaticMarkup(
			<LinkPageRenderer brand={defaultLinkPageBrand} document={document} locale='en' />
		);

		expect(html).toMatch(/data-links-header-blocks=""[\s\S]*aria-label="Instagram"/u);
		expect(html.match(/aria-label="Instagram"/gu)).toHaveLength(1);
		expect(html.indexOf('aria-label="Instagram"')).toBeLessThan(html.indexOf("Book a call"));
	});

	it("defaults design fields when parsing existing version three documents", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		const { headerBlockIds: _headerBlockIds, ...documentWithoutHeaderLinks } = document;
		const { header: _header, ...appearance } = document.appearance;
		const { appearance: _sectionAppearance, ...link } = createLink();

		const parsed = linkPageDocumentSchema.parse({
			...documentWithoutHeaderLinks,
			appearance,
			blocks: [link],
		});

		expect(parsed.headerBlockIds).toEqual([]);
		expect(parsed.appearance.header).toEqual({
			backgroundColor: null,
			foregroundColor: null,
			style: "plain",
		});
		expect(parsed.blocks[0]).toHaveProperty("appearance", defaultLinkPageSectionAppearance);
	});

	it("accepts up to one hundred links in a collection", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });

		const links = Array.from({ length: 100 }, (_, index) =>
			createLink({
				id: `00000000-0000-4000-8000-${(index + 1).toString().padStart(12, "0")}`,
			})
		);

		const collection = {
			appearance: defaultLinkPageSectionAppearance,
			display: "stack" as const,
			enabled: true,
			id: otherId,
			kind: "collection" as const,
			links,
			title: {},
		};

		expect(linkPageDocumentSchema.safeParse({ ...document, blocks: [collection] }).success).toBe(true);
		expect(
			linkPageDocumentSchema.safeParse({
				...document,
				blocks: [{ ...collection, links: [...links, createLink({ id: thirdId })] }],
			}).success
		).toBe(false);
	});

	it("resolves redirect targets only for enabled links", () => {
		const document: LinkPageDocument = {
			...createDefaultLinkPageDocument({ name: "Northstar" }),
			blocks: [
				createLink(),
				{
					appearance: defaultLinkPageSectionAppearance,
					display: "stack",
					enabled: true,
					id: otherId,
					kind: "collection",
					links: [createLink({ enabled: false, id: thirdId, url: "https://example.com/nested" })],
					title: {},
				},
			],
			redirectBlockId: linkId,
		};

		expect(resolveLinkPageRedirect({ document })).toBe("https://example.com/book");
		expect(resolveLinkPageRedirect({ document: { ...document, redirectBlockId: thirdId } })).toBeNull();
		expect(resolveLinkPageRedirect({ document: { ...document, redirectBlockId: null } })).toBeNull();
	});

	it("creates and resolves copy for every locale declared by Brand", () => {
		const brand = brandFoundationSchema.parse({
			...defaultLinkPageBrand,
			defaultLocale: "fr-CA",
			locales: ["fr-CA", "en", "ar"],
		});

		const document = createDefaultLinkPageDocument({ brand, name: "Northstar" });

		document.blocks.push(createLink({ label: { ar: "   ", en: "Book a call", "fr-CA": "Réserver un appel" } }));

		expect(Object.keys(document.profile.title)).toEqual(["fr-CA", "en", "ar"]);
		expect(resolveLinkPageCopy({ brand, document, locale: "fr-CA" })).toMatchObject({
			bio: "Everything you need, in one place.",
			blocks: [{ label: "Réserver un appel" }],
			title: "Northstar",
		});
		expect(resolveLinkPageCopy({ brand, document, locale: "ar" }).blocks[0]).toMatchObject({
			label: "Réserver un appel",
		});
	});

	const documentWith = (block: LinkPageBlock) => ({
		...createDefaultLinkPageDocument({ name: "Northstar" }),
		blocks: [block],
	});

	const textBlock = ({
		format = "rich",
		text,
	}: {
		format?: "plain" | "rich";
		text: Record<string, string>;
	}): LinkPageBlock => ({
		appearance: defaultLinkPageSectionAppearance,
		button: null,
		enabled: true,
		format,
		id: linkId,
		kind: "text",
		text,
	});

	it.each([
		["https://example.com/subscribe", true],
		["http://example.com/subscribe", false],
		["javascript:alert(1)", false],
	])("validates form action %s", (action, valid) => {
		expect(
			linkPageDocumentSchema.safeParse(
				documentWith({
					action,
					appearance: defaultLinkPageSectionAppearance,
					description: {},
					enabled: true,
					fields: [{ id: otherId, label: { en: "Email" }, required: true, type: "email" }],
					id: linkId,
					kind: "form",
					submitLabel: {},
					title: {},
				})
			).success
		).toBe(valid);
	});

	it.each([
		[{ en: "[Menu](https://example.com/menu)" }, true],
		[{ en: "[About](/about)" }, true],
		[{ en: "[Bad](data:text/html,x)" }, false],
		[{ en: "[Bad](ftp://example.com/x)" }, false],
		[{ ar: "ok", en: "[Bad](//evil.example)" }, false],
	])("validates rich text links in %j", (text, valid) => {
		expect(linkPageDocumentSchema.safeParse(documentWith(textBlock({ text }))).success).toBe(valid);
	});

	it("does not vet markdown links in plain text blocks", () => {
		const text = { en: "[Bad](data:text/html,x)" };
		expect(linkPageDocumentSchema.safeParse(documentWith(textBlock({ format: "plain", text }))).success).toBe(true);
	});

	it("renders only safe rich text hrefs", () => {
		const html = renderToStaticMarkup(
			<LinkPageRichText className='' text='[Good](https://example.com) and [Bad](data:text/html,x)' />
		);

		expect(html).toContain('href="https://example.com"');
		expect(html).not.toContain("data:");
		expect(html).toContain("Bad");
	});
});
