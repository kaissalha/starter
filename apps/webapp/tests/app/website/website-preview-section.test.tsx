import { createRef, Profiler } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WebsiteBlogVisibility } from "@/app/[locale]/dashboard/website/editor/website-blog-visibility";
import { WebsiteDisclosureItemControls } from "@/app/[locale]/dashboard/website/editor/website-disclosure-item-controls";
import { WebsiteHeaderMenu } from "@/app/[locale]/dashboard/website/editor/website-header-menu";
import { WebsiteLinkEditor } from "@/app/[locale]/dashboard/website/editor/website-inline-controls";
import { WebsiteInsertionGap } from "@/app/[locale]/dashboard/website/editor/website-insertion-gap";
import {
	recoverWebsitePreviewImage,
	revealWebsitePreviewImage,
	synchronizeWebsitePreviewImages,
} from "@/app/[locale]/dashboard/website/editor/website-preview-images";
import {
	WebsitePreviewSection,
	WebsiteSectionControlsProvider,
} from "@/app/[locale]/dashboard/website/editor/website-preview-section";
import { WebsiteSectionCatalogPanel } from "@/app/[locale]/dashboard/website/editor/website-section-catalog";
import {
	initialWebsiteGenerationState,
	useWebsiteGenerationStore,
} from "@/app/[locale]/dashboard/website/generation/website-generation-store";
import { apiClient } from "@/lib/api-client";
import {
	createWebsiteSectionPreviewDocument,
	entityIdFromSeed,
	instantiateTemplate,
	type SiteSection,
} from "@starter/infinite-website";
import { listSectionMenus } from "@starter/infinite-website/editing";
import {
	createWebsiteGenerationShell,
	generationPageKeys,
	websiteGenerationProfiles,
} from "@starter/infinite-website/generation";
import { nordicEdgeTemplate } from "@starter/infinite-website/templates/nordic-edge";
import nordicEdgeContent from "@starter/infinite-website/templates/nordic-edge/content";

import { mockOrganizationPermissions } from "../../mocks/organization-permissions";

const sectionActions = vi.hoisted(() => ({ edit: vi.fn() }));

const openAgent = vi.fn();

const openOverlay = vi.fn();

const openSectionCatalog = vi.fn();

const header: SiteSection = {
	anchor: "header",
	category: "header",
	contentId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32e",
	id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
	root: {
		id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32f",
		props: { children: [] },
		type: "box",
	},
	source: { pattern: "test-header" },
};

const profile = websiteGenerationProfiles[0];

if (!profile) {
	throw new Error("Expected a website generation profile");
}

const snapshot = createWebsiteGenerationShell({
	brief: {
		location: "Toronto",
		name: "Preview test",
		schemaVersion: 1,
		type: "test business",
	},
	localizations: {
		byLocale: {
			en: {
				kind: "plan",
				pages: generationPageKeys.map((pageKey) => ({
					description: `${pageKey} page.`,
					pageKey,
					title: pageKey,
				})),
				siteDescription: "Preview test website.",
			},
		},
		defaultLocale: "en",
	},
	profile,
	websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d331",
});

beforeEach(() => {
	useWebsiteGenerationStore.setState(initialWebsiteGenerationState);
	sectionActions.edit.mockReset();
	openAgent.mockReset();
	openOverlay.mockReset();
	openSectionCatalog.mockReset();
});

describe("website preview section", () => {
	it("toggles Blog visibility with a reversible eye control", () => {
		const props = {
			disabled: false,
			edit: sectionActions.edit,
			renderedSection: header,
			root: createRef<HTMLDivElement>(),
		};

		const view = render(<WebsiteBlogVisibility {...props} hidden={false} />);
		fireEvent.click(screen.getByRole("button", { name: "hideBlog" }));
		expect(sectionActions.edit).toHaveBeenLastCalledWith({ operation: "set-blog-navigation", visible: false });
		view.rerender(<WebsiteBlogVisibility {...props} hidden />);
		fireEvent.click(screen.getByRole("button", { name: "showBlog" }));
		expect(sectionActions.edit).toHaveBeenLastCalledWith({ operation: "set-blog-navigation", visible: true });
		view.rerender(<WebsiteBlogVisibility {...props} disabled hidden />);
		expect(screen.getByRole("button", { name: "showBlog" })).toBeDisabled();
	});

	it("adds a header link only after a label is entered and exposes bounded reordering", async () => {
		const user = userEvent.setup();

		const document = instantiateTemplate({
			content: nordicEdgeContent,
			createId: ({ kind, path }) => entityIdFromSeed({ seed: `header-controls:${kind}:${path}` }),
			definition: nordicEdgeTemplate,
			path: "/header-controls",
		});

		const section = document.structure.layout.header[0];
		const menu = section && listSectionMenus({ node: section.root })[0];

		if (!section || !menu) {
			throw new Error("Expected a header menu");
		}

		sectionActions.edit.mockResolvedValue(true);
		const root = createRef<HTMLDivElement>();
		render(
			<div ref={root}>
				<WebsiteHeaderMenu
					context={{ document, locale: "en", options: { pages: [], sections: [] } }}
					disabled={false}
					edit={sectionActions.edit}
					pending={null}
					root={root}
					section={section}
				/>
			</div>
		);
		await user.click(screen.getByRole("button", { name: "add" }));
		const dialog = within(screen.getByRole("dialog", { name: "manage" }));
		expect(dialog.getAllByRole("button", { name: "moveUp" })[0]).toBeDisabled();
		expect(dialog.getAllByRole("button", { name: "moveDown" }).at(-1)).toBeDisabled();
		const move = dialog.getAllByRole("button", { name: "moveDown" })[0];

		if (!move) {
			throw new Error("Expected reorder control");
		}

		await user.click(move);
		expect(sectionActions.edit).toHaveBeenCalledWith({
			elementId: menu.props.items[0]?.id,
			index: 1,
			operation: "move-menu-item",
			sectionId: section.id,
		});
		expect(dialog.getByRole("button", { name: "add" })).toBeDisabled();
		await user.type(dialog.getByRole("textbox", { name: "label" }), "Team");
		await user.click(dialog.getByRole("button", { name: "add" }));
		expect(sectionActions.edit).toHaveBeenLastCalledWith(
			expect.objectContaining({
				index: menu.props.items.length,
				label: "Team",
				locale: "en",
				menuId: menu.id,
				operation: "add-menu-item",
				sectionId: section.id,
			})
		);
	});

	it("selects only the tapped section on mobile and preserves focus inside its controls", async () => {
		const user = userEvent.setup();
		const media = window.matchMedia("");
		useWebsiteGenerationStore.setState({ snapshot });

		await vi.mocked(window.matchMedia).withImplementation(
			(query) => ({ ...media, matches: query === "(max-width: 767px), (pointer: coarse)", media: query }),
			async () => {
				render(
					<WebsiteSectionControlsProvider
						editor={{ disabled: false, edit: sectionActions.edit, openOverlay, pending: null }}
						openAgent={openAgent}
						openSectionCatalog={openSectionCatalog}
					>
						<WebsitePreviewSection hasLogic={false} section={header} target={{ area: "header", index: 0 }}>
							<span>Header background</span>
						</WebsitePreviewSection>
						<WebsitePreviewSection hasLogic={false} section={header} target={{ area: "footer", index: 0 }}>
							<span>Footer background</span>
							<input aria-label='Section text' />
						</WebsitePreviewSection>
					</WebsiteSectionControlsProvider>
				);

				const headerBackground = screen.getByText("Header background");
				const footerBackground = screen.getByText("Footer background");
				const headerSection = headerBackground.closest("[data-website-section-id]");
				const footerSection = footerBackground.closest("[data-website-section-id]");
				expect(headerSection).not.toHaveFocus();
				expect(footerSection).not.toHaveFocus();

				await user.click(headerBackground);
				expect(headerSection).toHaveFocus();
				await user.click(footerBackground);
				expect(footerSection).toHaveFocus();
				expect(headerSection).not.toHaveFocus();

				const text = screen.getByRole("textbox", { name: "Section text" });
				await user.click(text);
				expect(text).toHaveFocus();
				const footerDesign = screen.getAllByRole("button", { name: "sectionActions.design" }).at(1);

				if (!footerDesign) {
					throw new Error("Expected footer design control");
				}

				await user.click(footerDesign);
				expect(openOverlay).toHaveBeenCalledWith({
					kind: "layout",
					target: { area: "footer", index: 0, sectionId: header.id },
				});
			}
		);
	});

	it("keeps a generated placeholder shimmering until its asset settles", () => {
		const assetId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d33f";
		const container = document.createElement("section");
		container.dataset.websiteSectionId = header.id;
		container.innerHTML = '<div class="iw-media-frame"><img src="/website-image-placeholder.svg" /></div>';
		document.body.append(container);
		const image = container.querySelector("img");

		if (!image) {
			throw new Error("Expected a pending placeholder image");
		}

		Object.defineProperties(image, {
			complete: { configurable: true, value: true },
			naturalWidth: { configurable: true, value: 1200 },
		});

		useWebsiteGenerationStore.setState({
			completedEventKeys: {},
			readiness: {
				[header.id]: {
					assetIds: [assetId],
					contentReady: true,
					failed: false,
					resolvedAssetIds: {},
					sectionId: header.id,
					slotKey: "layout.footer",
				},
			},
			snapshot: {
				...snapshot,
				assets: { [assetId]: { src: "/website-image-placeholder.svg", type: "image" } },
			},
			websiteId: snapshot.templateId,
		});

		revealWebsitePreviewImage({ image });

		expect(image.closest(".iw-media-frame")).toHaveAttribute("data-website-media-ready", "false");
		expect(image.closest(".iw-media-frame")).toHaveAttribute("aria-busy", "true");
		const readiness = useWebsiteGenerationStore.getState().readiness[header.id];

		if (!readiness) {
			throw new Error("Expected pending placeholder readiness");
		}

		useWebsiteGenerationStore.setState({
			completedEventKeys: { [`asset:${assetId}`]: true },
			readiness: {
				[header.id]: {
					...readiness,
					resolvedAssetIds: { [assetId]: true },
				},
			},
		});
		synchronizeWebsitePreviewImages({ element: container, sectionId: header.id });

		expect(image.closest(".iw-media-frame")).toHaveAttribute("data-website-media-ready", "true");
		expect(image.closest(".iw-media-frame")).not.toHaveAttribute("aria-busy");
		container.remove();
	});

	it("settles a failed provider image to the deterministic placeholder", () => {
		const assetId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d340";
		const container = document.createElement("div");
		container.dataset.websiteSectionId = header.id;
		container.innerHTML = `<div class="iw-media-frame"><img src="https://images.unsplash.com/photo-test" /></div>`;
		document.body.append(container);
		const image = container.querySelector("img");

		if (!image) {
			throw new Error("Expected a provider image");
		}

		useWebsiteGenerationStore.setState({
			completedEventKeys: { [`asset:${assetId}`]: true },
			readiness: {
				[header.id]: {
					assetIds: [assetId],
					contentReady: true,
					failed: false,
					resolvedAssetIds: {},
					sectionId: header.id,
					slotKey: "pages.home.hero",
				},
			},
			snapshot: { ...snapshot, assets: { [assetId]: { src: image.src, type: "image" } } },
			websiteId: snapshot.templateId,
		});

		recoverWebsitePreviewImage({ image });

		expect(image.src).toMatch(/\/website-image-placeholder\.svg$/u);
		expect(image.closest(".iw-media-frame")).toHaveAttribute("data-website-media-ready", "true");
		expect(useWebsiteGenerationStore.getState().readiness[header.id]).toBeUndefined();
		container.remove();
	});

	it("settles the same loaded image source across sections", () => {
		const firstAssetId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d344";
		const secondAssetId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d345";
		const secondSectionId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d346";
		const source = "https://images.example.com/shared-preview-image.jpg";
		const container = document.createElement("div");
		container.innerHTML = `
			<section data-website-section-id="${header.id}">
				<div class="iw-media-frame"><img src="${source}" /></div>
			</section>
			<section data-website-section-id="${secondSectionId}">
				<div class="iw-media-frame"><img loading="lazy" src="${source}" /></div>
			</section>
		`;
		document.body.append(container);
		const images = container.querySelectorAll("img");
		const sections = container.querySelectorAll<HTMLElement>("section");
		const firstImage = images[0];
		const secondImage = images[1];
		const firstSection = sections[0];
		const secondSection = sections[1];

		if (!firstImage || !secondImage || !firstSection || !secondSection) {
			throw new Error("Expected shared preview sections and images");
		}

		useWebsiteGenerationStore.setState({
			completedEventKeys: { [`asset:${firstAssetId}`]: true, [`asset:${secondAssetId}`]: true },
			readiness: {
				[header.id]: {
					assetIds: [firstAssetId],
					contentReady: true,
					failed: false,
					resolvedAssetIds: {},
					sectionId: header.id,
					slotKey: "pages.home.hero",
				},
				[secondSectionId]: {
					assetIds: [secondAssetId],
					contentReady: true,
					failed: false,
					resolvedAssetIds: {},
					sectionId: secondSectionId,
					slotKey: "pages.home.gallery",
				},
			},
			snapshot: {
				...snapshot,
				assets: {
					...snapshot.assets,
					[firstAssetId]: { src: source, type: "image" },
					[secondAssetId]: { src: source, type: "image" },
				},
			},
			websiteId: snapshot.templateId,
		});

		synchronizeWebsitePreviewImages({ element: firstSection, sectionId: header.id });
		synchronizeWebsitePreviewImages({
			element: secondSection,
			sectionId: secondSectionId,
		});

		expect(firstImage.closest(".iw-media-frame")).toHaveAttribute("data-website-media-ready", "false");
		expect(secondImage.closest(".iw-media-frame")).toHaveAttribute("data-website-media-ready", "false");
		expect(firstImage.closest(".iw-media-frame")).toHaveAttribute("aria-busy", "true");
		expect(secondImage.closest(".iw-media-frame")).toHaveAttribute("aria-busy", "true");

		Object.defineProperties(firstImage, {
			complete: { configurable: true, value: true },
			naturalWidth: { configurable: true, value: 1200 },
		});
		revealWebsitePreviewImage({ image: firstImage });

		expect(firstImage.closest(".iw-media-frame")).toHaveAttribute("data-website-media-ready", "true");
		expect(secondImage.closest(".iw-media-frame")).toHaveAttribute("data-website-media-ready", "true");
		expect(firstImage.closest(".iw-media-frame")).not.toHaveAttribute("aria-busy");
		expect(secondImage.closest(".iw-media-frame")).not.toHaveAttribute("aria-busy");
		expect(useWebsiteGenerationStore.getState().readiness[header.id]).toBeUndefined();
		expect(useWebsiteGenerationStore.getState().readiness[secondSectionId]).toBeUndefined();
		container.remove();
	});

	it("isolates a preview after redirecting links to omitted sections", () => {
		const document = instantiateTemplate({
			content: nordicEdgeContent,
			createId: ({ kind, path }) => entityIdFromSeed({ seed: `section-preview:${kind}:${path}` }),
			definition: nordicEdgeTemplate,
			path: "/section-preview",
		});

		const page = document.structure.pages[0];
		const sectionIndex = page?.sections.findIndex(({ source }) => source?.pattern === "gallery-slideshow");
		const section = sectionIndex === undefined || sectionIndex < 0 ? undefined : page?.sections[sectionIndex];

		if (!page || !section || sectionIndex === undefined || sectionIndex < 0) {
			throw new Error("Expected linked page sections");
		}

		const preview = createWebsiteSectionPreviewDocument({
			document,
			section,
			target: { area: "page", index: sectionIndex, pageId: page.id, sectionId: section.id },
		});

		const previewContent = preview.content.en?.sections[section.contentId];

		expect(JSON.stringify(previewContent)).not.toContain('"anchor":"banner-card-and-background-image"');
		expect(preview.structure.pages[0]?.sections).toEqual([section]);
	});

	it("opens the design chooser from footer controls", () => {
		const footer: SiteSection = {
			...header,
			anchor: "footer",
			category: "footer",
			contentId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d342",
			id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d341",
			root: { ...header.root, id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d343" },
			source: { pattern: "test-footer" },
		};

		useWebsiteGenerationStore.setState({ snapshot });

		render(
			<WebsiteSectionControlsProvider
				editor={{ disabled: false, edit: sectionActions.edit, openOverlay, pending: null }}
				openAgent={openAgent}
				openSectionCatalog={openSectionCatalog}
			>
				<WebsitePreviewSection hasLogic={false} section={footer} target={{ area: "footer", index: 0 }}>
					<span>Footer content</span>
				</WebsitePreviewSection>
			</WebsiteSectionControlsProvider>
		);

		const wrapper = screen.getByText("Footer content").closest("[data-area]");
		const toolbar = screen.getByRole("toolbar", { name: "sectionActions.toolbar" });
		const addSection = screen.getByRole("button", { name: "add" });
		const page = snapshot.document.structure.pages.find((candidate) => candidate.home);

		if (!page) {
			throw new Error("Expected a generated home page");
		}

		expect(wrapper).toHaveAttribute("data-editable", "true");
		expect(within(toolbar).getAllByRole("button")).toHaveLength(1);
		fireEvent.click(within(toolbar).getByRole("button", { name: "sectionActions.design" }));
		fireEvent.click(addSection);

		expect(openOverlay).toHaveBeenCalledWith({
			kind: "layout",
			target: { area: "footer", index: 0, sectionId: footer.id },
		});
		expect(openSectionCatalog).toHaveBeenCalledWith({
			target: { index: page.sections.length, pageId: page.id },
		});
	});

	it("gives nested editing ownership over header design controls", () => {
		useWebsiteGenerationStore.setState({ snapshot });

		render(
			<WebsiteSectionControlsProvider
				editor={{ disabled: false, edit: sectionActions.edit, openOverlay, pending: null }}
				nestedEditingSectionId={header.id}
				openAgent={openAgent}
				openSectionCatalog={openSectionCatalog}
			>
				<WebsitePreviewSection hasLogic={false} section={header} target={{ area: "header", index: 0 }}>
					<span data-website-menu-item=''>About</span>
				</WebsitePreviewSection>
			</WebsiteSectionControlsProvider>
		);

		expect(screen.queryByRole("toolbar", { name: "sectionActions.toolbar" })).not.toBeInTheDocument();
	});

	it("positions header controls in the largest menu-adjacent gap in both directions", () => {
		useWebsiteGenerationStore.setState({ snapshot });

		render(
			<WebsiteSectionControlsProvider
				editor={{ disabled: false, edit: sectionActions.edit, openOverlay, pending: null }}
				openAgent={openAgent}
				openSectionCatalog={openSectionCatalog}
			>
				<WebsitePreviewSection hasLogic={false} section={header} target={{ area: "header", index: 0 }}>
					<span data-testid='empty-header-space' />
					<span data-testid='brand-region' data-website-layout-occupied='brand'>
						Logo
					</span>
					<span data-testid='navigation-region' data-website-layout-occupied='navigation'>
						<span data-website-inline-link=''>About</span>
						<span data-website-inline-link=''>Contact</span>
					</span>
					<span data-testid='actions-region' data-website-layout-occupied='actions'>
						Book
					</span>
				</WebsitePreviewSection>
			</WebsiteSectionControlsProvider>
		);

		const wrapper = screen.getByTestId("empty-header-space").closest("[data-area]");
		const actionsRegion = screen.getByTestId("actions-region");
		const brandRegion = screen.getByTestId("brand-region");
		const navigationRegion = screen.getByTestId("navigation-region");
		const toolbar = screen.getByRole("toolbar", { name: "sectionActions.toolbar" });

		if (!(wrapper instanceof HTMLElement)) {
			throw new Error("Expected a header wrapper");
		}

		vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue(
			DOMRect.fromRect({ height: 80, width: 600, x: 0, y: 0 })
		);

		const brandBounds = vi
			.spyOn(brandRegion, "getBoundingClientRect")
			.mockReturnValue(DOMRect.fromRect({ height: 40, width: 80, x: 100, y: 30 }));

		const navigationBounds = vi
			.spyOn(navigationRegion, "getBoundingClientRect")
			.mockReturnValue(DOMRect.fromRect({ height: 40, width: 200, x: 300, y: 30 }));

		const actionsBounds = vi
			.spyOn(actionsRegion, "getBoundingClientRect")
			.mockReturnValue(DOMRect.fromRect({ height: 40, width: 40, x: 520, y: 30 }));

		expect(wrapper).toHaveAttribute("data-layout-controls-visible", "true");
		expect(toolbar).toHaveClass("opacity-0", "md:[@media(pointer:fine)]:group-hover/website-section:opacity-100");
		fireEvent(window, new Event("resize"));
		expect(wrapper.style.getPropertyValue("--website-editor-header-design-position")).toBe("240px");

		wrapper.dir = "rtl";
		brandBounds.mockReturnValue(DOMRect.fromRect({ height: 40, width: 80, x: 500, y: 30 }));
		navigationBounds.mockReturnValue(DOMRect.fromRect({ height: 40, width: 200, x: 100, y: 30 }));
		actionsBounds.mockReturnValue(DOMRect.fromRect({ height: 40, width: 40, x: 40, y: 30 }));
		fireEvent(window, new Event("resize"));
		expect(wrapper.style.getPropertyValue("--website-editor-header-design-position")).toBe("400px");

		wrapper.dir = "ltr";
		brandBounds.mockReturnValue(DOMRect.fromRect({ height: 40, width: 80, x: 20, y: 30 }));
		navigationBounds.mockReturnValue(DOMRect.fromRect({ height: 40, width: 180, x: 120, y: 30 }));
		actionsBounds.mockReturnValue(DOMRect.fromRect({ height: 40, width: 80, x: 500, y: 30 }));
		fireEvent(window, new Event("resize"));
		expect(wrapper.style.getPropertyValue("--website-editor-header-design-position")).toBe("400px");

		wrapper.dir = "rtl";
		brandBounds.mockReturnValue(DOMRect.fromRect({ height: 40, width: 80, x: 500, y: 30 }));
		navigationBounds.mockReturnValue(DOMRect.fromRect({ height: 40, width: 180, x: 300, y: 30 }));
		actionsBounds.mockReturnValue(DOMRect.fromRect({ height: 40, width: 80, x: 20, y: 30 }));
		fireEvent(window, new Event("resize"));
		expect(wrapper.style.getPropertyValue("--website-editor-header-design-position")).toBe("200px");
	});

	it("positions page controls at the logical top end", () => {
		const page = snapshot.document.structure.pages[0];

		if (!page) {
			throw new Error("Expected a generated home page");
		}

		useWebsiteGenerationStore.setState({
			snapshot: {
				...snapshot,
				document: {
					...snapshot.document,
					structure: {
						...snapshot.document.structure,
						pages: snapshot.document.structure.pages.with(0, { ...page, sections: [header] }),
					},
				},
			},
		});

		render(
			<WebsiteSectionControlsProvider
				editor={{
					disabled: false,
					edit: sectionActions.edit,
					openOverlay,
					pending: null,
				}}
				openAgent={openAgent}
				openSectionCatalog={openSectionCatalog}
			>
				<WebsitePreviewSection
					hasLogic={false}
					section={header}
					target={{ area: "page", index: 0, pageId: page.id, sectionCount: 1 }}
				>
					<span>Page section</span>
				</WebsitePreviewSection>
			</WebsiteSectionControlsProvider>
		);

		const toolbar = screen.getByRole("toolbar", { name: "sectionActions.toolbar" });
		const addSection = screen.getByRole("button", { name: "add" });

		expect(within(toolbar).queryByRole("button", { name: "sectionCatalog.add" })).not.toBeInTheDocument();
		expect(screen.getAllByRole("button", { name: "add" })).toHaveLength(1);
		fireEvent.click(addSection);
		expect(openSectionCatalog).toHaveBeenCalledWith({ target: { index: 1, pageId: page.id } });
	});

	it("offsets sticky page controls below the rendered website header", () => {
		const bounds = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
			this: HTMLElement
		) {
			if (this.classList.contains("website-container")) {
				return DOMRect.fromRect({ height: 800, width: 1200, x: 0, y: -1000 });
			}

			if (this.dataset.testid === "header-layout") {
				return DOMRect.fromRect({ height: 72, width: 1200, x: 0, y: -1000 });
			}

			return DOMRect.fromRect();
		});

		const { container } = render(
			<div className='website-container'>
				<WebsitePreviewSection hasLogic={false} section={header} target={{ area: "header", index: 0 }}>
					<div className='iw-layout' data-testid='header-layout'>
						<span className='iw-layout'>Hidden responsive content</span>
					</div>
				</WebsitePreviewSection>
			</div>
		);

		expect(
			container
				.querySelector<HTMLElement>(".website-container")
				?.style.getPropertyValue("--website-editor-header-block-size")
		).toBe("72px");
		bounds.mockRestore();
	});

	it("routes behavior section editing to the website agent", () => {
		const page = snapshot.document.structure.pages[0];

		const customSection: SiteSection = { ...header, source: undefined };

		if (!page) {
			throw new Error("Expected a generated home page");
		}

		useWebsiteGenerationStore.setState({
			snapshot: {
				...snapshot,
				document: {
					...snapshot.document,
					structure: {
						...snapshot.document.structure,
						pages: snapshot.document.structure.pages.with(0, { ...page, sections: [customSection] }),
					},
				},
			},
		});

		render(
			<WebsiteSectionControlsProvider
				editor={{
					disabled: false,
					edit: sectionActions.edit,
					openOverlay,
					pending: null,
				}}
				openAgent={openAgent}
				openSectionCatalog={openSectionCatalog}
			>
				<WebsitePreviewSection
					hasLogic
					section={customSection}
					target={{ area: "page", index: 0, pageId: page.id, sectionCount: 1 }}
				>
					<span>Custom section</span>
				</WebsitePreviewSection>
			</WebsiteSectionControlsProvider>
		);

		expect(screen.queryByRole("button", { name: "sectionActions.design" })).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "sectionActions.aiEdit" }));

		expect(openAgent).toHaveBeenCalledOnce();
		expect(openOverlay).not.toHaveBeenCalled();
	});

	it("shows design, move, and confirmed delete actions in the section hover toolbar", () => {
		const page = snapshot.document.structure.pages[0];

		const secondSection: SiteSection = {
			...header,
			anchor: "second-section",
			contentId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d33a",
			id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339",
			root: { ...header.root, id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d33b" },
		};

		if (!page) {
			throw new Error("Expected a generated home page");
		}

		useWebsiteGenerationStore.setState({
			snapshot: {
				...snapshot,
				document: {
					...snapshot.document,
					structure: {
						...snapshot.document.structure,
						pages: snapshot.document.structure.pages.with(0, {
							...page,
							sections: [header, secondSection],
						}),
					},
				},
			},
		});

		render(
			<WebsiteSectionControlsProvider
				editor={{
					disabled: false,
					edit: sectionActions.edit,
					openOverlay,
					pending: null,
				}}
				openAgent={openAgent}
				openSectionCatalog={openSectionCatalog}
			>
				<WebsitePreviewSection
					hasLogic={false}
					section={header}
					target={{ area: "page", index: 0, pageId: page.id, sectionCount: 2 }}
				>
					<span>Page section</span>
				</WebsitePreviewSection>
			</WebsiteSectionControlsProvider>
		);

		const toolbar = screen.getByRole("toolbar", { name: "sectionActions.toolbar" });

		expect(within(toolbar).getByRole("button", { name: "sectionActions.design" })).toBeInTheDocument();
		expect(within(toolbar).getByRole("button", { name: "sectionActions.moveUp" })).toBeDisabled();
		fireEvent.click(within(toolbar).getByRole("button", { name: "sectionActions.moveDown" }));
		fireEvent.click(within(toolbar).getByRole("button", { name: "sectionActions.delete" }));
		fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "cancel" }));
		expect(sectionActions.edit).toHaveBeenCalledOnce();
		fireEvent.click(within(toolbar).getByRole("button", { name: "sectionActions.delete" }));
		fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "sectionActions.delete" }));

		expect(sectionActions.edit).toHaveBeenNthCalledWith(1, {
			operation: "move-down",
			pageId: page.id,
			sectionId: header.id,
		});

		expect(sectionActions.edit).toHaveBeenNthCalledWith(2, {
			operation: "delete",
			pageId: page.id,
			sectionId: header.id,
		});
	});

	it("adds and deletes accordion items from the hovered item controls", () => {
		const itemClick = vi.fn();
		const itemPointerDown = vi.fn();

		const target = {
			collection: "/accordion",
			contentItemId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d362",
			disclosureId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d360",
			index: 3,
			itemCount: 4,
			itemId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d361",
			max: 10,
			min: 1,
			sectionId: header.id,
		};

		render(
			<div onClick={itemClick} onPointerDown={itemPointerDown}>
				<WebsiteDisclosureItemControls
					editor={{ disabled: false, edit: sectionActions.edit, pending: null }}
					target={target}
				/>
			</div>
		);

		const add = screen.getByRole("button", { name: "add" });

		fireEvent.pointerDown(add);
		fireEvent.click(add);
		fireEvent.click(screen.getByRole("button", { name: "delete" }));

		expect(itemPointerDown).not.toHaveBeenCalled();
		expect(itemClick).not.toHaveBeenCalled();
		expect(sectionActions.edit).toHaveBeenCalledTimes(1);
		fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "delete" }));

		expect(sectionActions.edit).toHaveBeenNthCalledWith(1, {
			collection: "/accordion",
			itemId: expect.any(String),
			operation: "add-collection-item",
			sectionId: header.id,
		});

		expect(sectionActions.edit).toHaveBeenNthCalledWith(2, {
			collection: "/accordion",
			itemId: target.contentItemId,
			operation: "delete-collection-item",
			sectionId: header.id,
		});
	});

	it("saves a button destination from the inline link editor", () => {
		const anchor = document.createElement("a");
		const onClose = vi.fn();
		const onSave = vi.fn();
		document.body.append(anchor);

		render(
			<WebsiteLinkEditor
				anchor={anchor}
				disabled={false}
				onClose={onClose}
				onSave={onSave}
				options={{ pages: [], sections: [] }}
				target={{
					contentId: header.contentId,
					elementId: header.root.id,
					elementType: "action",
					href: "https://example.com",
					labels: [
						{
							content: "Book now",
							nodeId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d370",
							pointer: "/actions/items/action/label",
						},
						{
							content: "Book now",
							nodeId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d371",
							pointer: "/actions/items/action/mobile-label",
						},
					],
					locale: "en",
					pointer: "/actions/items/action/link",
					sectionId: header.id,
					value: { kind: "external", url: "https://example.com" },
				}}
			/>
		);

		fireEvent.change(screen.getByDisplayValue("https://example.com"), {
			target: { value: "https://example.com/book" },
		});

		fireEvent.change(screen.getByDisplayValue("Book now"), { target: { value: "Reserve" } });

		fireEvent.click(screen.getByRole("button", { name: "save" }));

		expect(onClose).toHaveBeenCalledOnce();

		expect(onSave).toHaveBeenCalledWith({
			label: {
				pointers: ["/actions/items/action/label", "/actions/items/action/mobile-label"],
				value: "Reserve",
			},
			value: { kind: "external", url: "https://example.com/book" },
		});

		anchor.remove();
	});

	it("does not render an insertion gap outside an active addition", () => {
		const { container } = render(
			<WebsiteInsertionGap target={{ area: "page", index: 1, pageId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330" }} />
		);

		expect(container).toBeEmptyDOMElement();
	});

	it("shows top and bottom insertion targets for the hovered section", () => {
		const pageId = snapshot.document.structure.pages[0]?.id;

		if (!pageId) {
			throw new Error("Expected a generated home page");
		}

		useWebsiteGenerationStore.setState({ snapshot });

		render(
			<WebsiteSectionControlsProvider
				editor={{ disabled: false, edit: sectionActions.edit, openOverlay, pending: null }}
				openAgent={openAgent}
				openSectionCatalog={openSectionCatalog}
			>
				<WebsitePreviewSection
					hasLogic={false}
					section={header}
					target={{ area: "page", index: 1, pageId, sectionCount: 3 }}
				>
					<span>Hovered section</span>
				</WebsitePreviewSection>
			</WebsiteSectionControlsProvider>
		);

		const controls = screen.getAllByRole("button", { name: "add" });
		const [topControl, bottomControl] = controls;

		if (!topControl || !bottomControl) {
			throw new Error("Expected top and bottom section insertion controls");
		}

		expect(controls).toHaveLength(2);
		expect(topControl.closest(String.raw`.group\/button-reveal`)).not.toBeNull();
		fireEvent.click(topControl);
		fireEvent.click(bottomControl);
		expect(openSectionCatalog).toHaveBeenNthCalledWith(1, { target: { index: 1, pageId } });
		expect(openSectionCatalog).toHaveBeenNthCalledWith(2, { target: { index: 2, pageId } });
	});

	it("reserves the exact insertion gap until the prepared section arrives", () => {
		const pageId = snapshot.document.structure.pages[0]?.id;

		if (!pageId) {
			throw new Error("Expected a generated home page");
		}

		useWebsiteGenerationStore.getState().startSectionAddition({
			baseSnapshot: snapshot,
			snapshot,
			target: { index: 1, pageId },
			websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d331",
		});

		const { rerender } = render(<WebsiteInsertionGap target={{ area: "page", index: 1, pageId }} />);

		expect(screen.getByRole("status", { name: "preparing" })).toHaveAttribute("data-website-insertion-gap");

		act(() => {
			useWebsiteGenerationStore.setState({
				readiness: {
					"018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339": {
						assetIds: [],
						contentReady: false,
						failed: false,
						resolvedAssetIds: {},
						sectionId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339",
						slotKey: "section-additions.run-addition",
					},
				},
			});
		});

		rerender(<WebsiteInsertionGap target={{ area: "page", index: 1, pageId }} />);
		expect(screen.queryByRole("status", { name: "preparing" })).not.toBeInTheDocument();
	});

	it("does not rerender a reserved insertion gap when only workflow metadata changes", () => {
		const pageId = snapshot.document.structure.pages[0]?.id;
		const onRender = vi.fn();

		if (!pageId) {
			throw new Error("Expected a generated home page");
		}

		useWebsiteGenerationStore.getState().startSectionAddition({
			baseSnapshot: snapshot,
			snapshot,
			target: { index: 1, pageId },
			websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d331",
		});

		render(
			<Profiler id='insertion-gap' onRender={onRender}>
				<WebsiteInsertionGap target={{ area: "page", index: 1, pageId }} />
			</Profiler>
		);

		const initialRenderCount = onRender.mock.calls.length;

		act(() => {
			useWebsiteGenerationStore.getState().attachWorkflow({
				runId: "run-section-addition",
				websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d331",
			});
		});

		expect(onRender).toHaveBeenCalledTimes(initialRenderCount);
		expect(screen.getByRole("status", { name: "preparing" })).toBeInTheDocument();
	});

	it("renders the first catalog preview batch and submits the selected pattern", async () => {
		const user = userEvent.setup();
		const pageId = snapshot.document.structure.pages[0]?.id;
		const definition = profile.sections[0];
		const onSelect = vi.fn().mockResolvedValue(undefined);

		if (!pageId || !definition) {
			throw new Error("Expected a generated home page and candidate section");
		}

		useWebsiteGenerationStore.setState({ snapshot });
		useWebsiteGenerationStore.getState().openCatalog({ target: { index: 2, pageId } });

		const patterns = [definition.pattern, ...[1, 2, 3, 4].map((index) => `${definition.pattern}-${index}`)];

		const catalog = patterns.map((pattern) => ({
			assetFields: 0,
			category: definition.category,
			linkFields: 0,
			pattern,
			previewAvailable: true,
			roles: ["body"],
			score: 100,
			templateAffinity: true,
			textFields: 1,
		}));

		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

		const catalogOptions = apiClient.websites.sectionCatalog.queryOptions({
			input: {
				category: undefined,
				index: 2,
				pageId,
				query: undefined,
				websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d331",
			},
		});

		const fixtureDocument = instantiateTemplate({
			content: nordicEdgeContent,
			createId: ({ kind, path }) => entityIdFromSeed({ seed: `catalog-preview:${kind}:${path}` }),
			definition: nordicEdgeTemplate,
			path: "/catalog-preview",
		});

		const fixturePage = fixtureDocument.structure.pages[0];
		const section = fixturePage?.sections[0];

		if (!fixturePage || !section) {
			throw new Error("Expected a fixture section");
		}

		const previewDocument = createWebsiteSectionPreviewDocument({
			document: fixtureDocument,
			section,
			target: { area: "page", index: 0, pageId: fixturePage.id, sectionId: section.id },
		});

		const previewOptions = apiClient.websites.sectionPreviews.queryOptions({
			input: {
				pageId,
				patterns: patterns.slice(0, 4),
				websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d331",
			},
		});

		const deferredPreviewOptions = apiClient.websites.sectionPreviews.queryOptions({
			input: {
				pageId,
				patterns: patterns.slice(4),
				websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d331",
			},
		});

		queryClient.setQueryData(catalogOptions.queryKey, { patterns: catalog, recommendedPattern: null });
		queryClient.setQueryData(
			previewOptions.queryKey,
			patterns.slice(0, 4).map((pattern) => ({ assets: snapshot.assets, document: previewDocument, pattern }))
		);

		render(
			<QueryClientProvider client={queryClient}>
				<WebsiteSectionCatalogPanel
					onSelect={onSelect}
					snapshot={snapshot}
					websiteId='018ff7c2-1f7c-7b28-b6c1-3f2e60b5d331'
				/>
			</QueryClientProvider>
		);

		expect(screen.getByRole("heading", { name: "title" })).toBeInTheDocument();
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

		const select = await screen.findByRole("button", {
			name: `select ${definition.pattern.replaceAll("-", " ")}`,
		});

		expect(select).toBeEmptyDOMElement();
		expect(screen.queryByText(definition.pattern.replaceAll("-", " "))).not.toBeInTheDocument();
		expect(queryClient.getQueryState(deferredPreviewOptions.queryKey)?.fetchStatus).toBe("idle");

		await user.click(select);

		expect(onSelect).toHaveBeenCalledWith({
			index: 2,
			pageId,
			pattern: definition.pattern,
			previewDocument,
		});
		expect(useWebsiteGenerationStore.getState().catalogTarget).toBeNull();
	});
});

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));
