import type { ReactNode } from "react";

import Link from "next/link";

import { PaintBoardIcon } from "@hugeicons/core-free-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withBlogNavigation, type BlogPostSummary, type SiteDocument } from "@starter/infinite-website";
import type {
	SiteLinkElementPropsResolver,
	SiteLinkElementTarget,
	SiteTextElementPropsResolver,
	SiteTextElementTarget,
} from "@starter/infinite-website/preview";
import { SidebarProvider } from "@starter/ui/components/sidebar";

import { mockOrganizationPermissions } from "../../mocks/organization-permissions";
import { mockUsePathname, mockUseRouter } from "../../mocks/routing";

const controllerMock = vi.hoisted(() => vi.fn());

const getWebsite = vi.hoisted(() => vi.fn());

const getAgentChat = vi.hoisted(() => vi.fn());

const publishWebsite = vi.hoisted(() => vi.fn());

const chatSessionProvider = vi.hoisted(() => vi.fn());

const chatSessionState = vi.hoisted<{ messages: Array<unknown>; status: string }>(() => ({
	messages: [],
	status: "ready",
}));

const notifyWebsiteChange = vi.hoisted(() => vi.fn<() => void>());

const sitePreviewRenderer = vi.hoisted(() => vi.fn());

const previewDocument = vi.hoisted(() => vi.fn());

const blogPosts = vi.hoisted(() => vi.fn<() => Array<BlogPostSummary>>(() => []));

const mobileViewport = vi.hoisted(() => ({ value: true }));

vi.mock("@starter/ui/hooks/use-is-mobile", () => ({
	useIsMobile: () => mobileViewport.value,
}));

vi.mock("@/app/[locale]/dashboard/website/editor/use-website-blog-posts", () => ({
	useWebsiteBlogPosts: blogPosts,
}));

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		brands: {
			recommend: {
				mutationOptions: (options: { onError?: () => void; onSuccess?: () => void }) => ({
					...options,
					mutationFn: async () => ({ probabilities: null, revision: "revision", update: null }),
					mutationKey: ["brands", "recommend"],
				}),
			},
		},
		domains: {
			list: {
				queryOptions: () => ({
					queryFn: async () => ({ address: null, domains: [], registrations: [], subdomain: null }),
					queryKey: ["domains", "list"],
				}),
			},
		},
		websites: {
			agentChat: {
				key: () => ["websites", "agentChat"],
				queryOptions: () => ({ queryFn: getAgentChat, queryKey: ["websites", "agentChat"] }),
			},
			get: {
				key: () => ["websites", "get"],
				queryKey: () => ["websites", "get"],
				queryOptions: () => ({ queryFn: getWebsite, queryKey: ["websites", "get"] }),
			},
			templateRecommendations: {
				queryOptions: () => ({
					queryFn: async () => ({ templateIds: [] }),
					queryKey: ["websites", "templateRecommendations"],
				}),
			},
			templates: {
				queryOptions: () => ({ queryFn: async () => [], queryKey: ["websites", "templates"] }),
			},
		},
	},
	client: { websites: { get: getWebsite, publish: publishWebsite } },
}));

vi.mock("@/components/chat/stores/chat-session-store", () => ({
	ChatSessionProvider: ({
		children,
		...props
	}: {
		children: ReactNode;
		initialMessages?: Array<unknown>;
		runtime: { onDataChange?: { website?: () => void } };
	}) => {
		chatSessionProvider(props);
		notifyWebsiteChange.mockImplementation(() => props.runtime.onDataChange?.website?.());

		return children;
	},
	selectChatSessionBusy: ({ messages, status }: { messages: Array<unknown>; status: string }) =>
		status === "streaming" || status === "submitted" || messages.length > 0,
	useChatSession: <T,>(selector: (state: typeof chatSessionState) => T) => selector(chatSessionState),
}));

vi.mock("@/components/chat/chat-content", () => ({
	ChatContent: () => <textarea data-testid='website-agent-chat' />,
}));

vi.mock("@starter/ui/components/scroll-area", () => ({
	ScrollArea: ({ children, viewportClassName }: { children: ReactNode; viewportClassName?: string }) => (
		<div className={viewportClassName} data-slot='scroll-area-viewport'>
			{children}
		</div>
	),
}));

const previewEditor = {
	cancelDraft: vi.fn(),
	closeDraft: vi.fn(),
	commitDraft: vi.fn(),
	disabled: false,
	draft: null,
	edit: vi.fn(),
	layoutTarget: null,
	locale: "en" as const,
	mediaTarget: null,
	mode: "edit" as const,
	openOverlay: vi.fn(),
	overlay: null,
	pending: null,
	previewDraft: vi.fn(),
	publish: vi.fn(),
	publishing: false,
	setState: vi.fn(),
	sidebarMode: "page" as const,
	viewport: "desktop" as const,
};

vi.mock("@starter/infinite-website/preview", () => ({
	SitePreviewRenderer: ({
		disclosureItemControls,
		document,
		insertionGapComponent,
		linkElementProps,
		locale,
		pageSlug,
		textElementProps,
	}: {
		disclosureItemControls?: unknown;
		document: SiteDocument;
		insertionGapComponent?: unknown;
		linkElementProps?: SiteLinkElementPropsResolver;
		locale?: string;
		pageSlug?: string;
		textElementProps?: SiteTextElementPropsResolver;
	}) => {
		previewDocument(document);
		sitePreviewRenderer({
			disclosureItemControls: Boolean(disclosureItemControls),
			insertionGapComponent: Boolean(insertionGapComponent),
			linkElementProps: Boolean(linkElementProps),
			textElementProps: Boolean(textElementProps),
		});

		const label: SiteTextElementTarget = {
			content: "Book now",
			contentId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d381",
			linkLabel: true,
			locale: "en",
			nodeId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d382",
			pointer: "/actions/items/action/label",
			sectionId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d380",
		};

		const action: SiteLinkElementTarget = {
			contentId: label.contentId,
			elementId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d383",
			elementType: "action",
			href: "https://example.com",
			labels: [{ content: label.content, nodeId: label.nodeId, pointer: label.pointer }],
			locale: "en",
			pointer: "/actions/items/action/link",
			sectionId: label.sectionId,
			value: { kind: "external", url: "https://example.com" },
		};

		const menuLink: SiteLinkElementTarget = {
			contentId: label.contentId,
			elementId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d384",
			elementType: "menu",
			href: "/about",
			labels: [{ content: "Header About", nodeId: label.nodeId, pointer: "/navigation/items/about/label" }],
			locale: "en",
			menuItem: {
				elementId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d384",
				items: [],
				labels: [{ content: "Header About", nodeId: label.nodeId, pointer: "/navigation/items/about/label" }],
				locale: "en",
				pointer: "/navigation/items/about/link",
				sectionId: label.sectionId,
				value: { kind: "relative", path: "/about" },
			},
			menuRole: "navigation-item",
			pointer: "/navigation/items/about/link",
			sectionId: label.sectionId,
			value: { kind: "relative", path: "/about" },
		};

		return (
			<div data-locale={locale} data-page-slug={pageSlug} data-testid='site-preview'>
				<Link href={{ pathname: "/" }}>Home</Link>
				<Link href='/blog'>Blog</Link>
				<Link href={locale === "ar" ? "/من-نحن?source=preview" : "/about?source=preview"}>About</Link>
				<a href='https://example.com'>External</a>
				<a {...linkElementProps?.(action)} data-testid='editable-action' href={action.href}>
					<span {...textElementProps?.(label)} data-testid='editable-action-label'>
						{label.content}
					</span>
				</a>
				<a {...linkElementProps?.(menuLink)} data-testid='editable-menu-link' href={menuLink.href}>
					Header About
				</a>
			</div>
		);
	},
}));

vi.mock("@starter/infinite-website", async (importOriginal) => ({
	...(await importOriginal<typeof import("@starter/infinite-website")>()),
	SiteRenderer: ({ locale, pageSlug }: { locale?: string; pageSlug?: string }) => (
		<div data-locale={locale} data-page-slug={pageSlug} data-testid='site-renderer'>
			<Link href={{ pathname: "/" }}>Home</Link>
			<Link href='/blog'>Blog</Link>
			<Link href={locale === "ar" ? "/من-نحن?source=preview" : "/about?source=preview"}>About</Link>
			<a href='https://example.com'>External</a>
		</div>
	),
}));

vi.mock("@/app/[locale]/dashboard/website/editor/website-section-catalog", () => ({
	WebsiteInsertionGap: () => null,
	WebsiteSectionCatalogPanel: () => null,
}));

vi.mock("@/app/[locale]/dashboard/website/generation/use-website-generation-controller", () => ({
	useWebsiteGenerationController: controllerMock,
}));

vi.mock("@/app/[locale]/dashboard/components/layout/header/header", () => ({
	Header: ({
		actions,
		afterLabel,
		center,
		className,
		leading,
	}: {
		actions?: ReactNode;
		afterLabel?: ReactNode;
		center?: ReactNode;
		className?: string;
		leading?: ReactNode;
	}) => (
		<header className={className}>
			{leading}
			{afterLabel}
			{center}
			{actions}
		</header>
	),
}));

import {
	WebsiteEditorAgentProvider,
	WebsiteEditorSidebar,
} from "@/app/[locale]/dashboard/website/editor/website-editor-sidebar";
import { WebsiteGenerationPreview } from "@/app/[locale]/dashboard/website/editor/website-generation-preview";
import {
	initialWebsiteGenerationState,
	useWebsiteGenerationStore,
} from "@/app/[locale]/dashboard/website/generation/website-generation-store";
import { WebsitePage } from "@/app/[locale]/dashboard/website/website-page";
import {
	createWebsiteGenerationShell,
	generationPageKeys,
	selectWebsiteGenerationProfile,
} from "@starter/infinite-website/generation";

const websiteId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d";

const replacementWebsiteId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330";

const chatId = "c105eab6-22e1-5995-8874-4563c747240d";

const brief = { location: "Toronto", name: "Northstar", schemaVersion: 1 as const, type: "Design studio" };

const snapshot = createWebsiteGenerationShell({
	brief,
	localizations: {
		byLocale: {
			ar: {
				kind: "plan",
				pages: generationPageKeys.map((pageKey) => ({
					description: `معلومات صفحة ${pageKey}.`,
					pageKey,
					title: `صفحة ${pageKey}`,
				})),
				siteDescription: "استوديو تصميم في تورونتو.",
			},
			en: {
				kind: "plan",
				pages: generationPageKeys.map((pageKey) => ({
					description: `The ${pageKey} page.`,
					pageKey,
					title: pageKey,
				})),
				siteDescription: "A Toronto design studio.",
			},
		},
		defaultLocale: "en",
	},
	profile: selectWebsiteGenerationProfile({ businessType: brief.type }),
	websiteId,
});

const aboutPageId = snapshot.document.structure.pages.find(
	(page) => snapshot.document.content.en?.pages[page.id]?.route?.slug === "about"
)?.id;

const homePageId = snapshot.document.structure.pages.find((page) => page.home)?.id;

if (!aboutPageId || !homePageId) {
	throw new Error("Expected the generated website fixture to include home and about pages");
}

const localizedSnapshot = structuredClone(snapshot);

const arabicAboutContent = localizedSnapshot.document.content.ar?.pages[aboutPageId];

if (!arabicAboutContent?.route) {
	throw new Error("Expected the generated website fixture to include Arabic about-page content");
}

arabicAboutContent.route.slug = "من-نحن";

const previewProps = {
	additionActive: false,
	additionFailed: false,
	additionRecoverable: false,
	additionTarget: null,
	editor: previewEditor,
	layoutGenerationActive: false,
	layoutGenerationFailed: false,
	layoutGenerationRecoverable: false,
	mode: "edit" as const,
	onAddSection: vi.fn(),
	onOpenAgent: vi.fn(),
	onOpenSectionCatalog: vi.fn(),
	onRetry: vi.fn(),
	phase: "ready" as const,
	snapshot,
	viewport: "desktop" as const,
};

const renderWebsitePage = ({
	seedAgentChat = true,
	websitesUrl,
}: { seedAgentChat?: boolean; websitesUrl?: string } = {}) => {
	const queryClient = new QueryClient();

	if (seedAgentChat) {
		queryClient.setQueryData(["websites", "agentChat"], { chatId, messages: [] });
	}

	return render(
		<QueryClientProvider client={queryClient}>
			<WebsitePage websitesUrl={websitesUrl} />
		</QueryClientProvider>,
		{ wrapper: NuqsTestingAdapter }
	);
};

const waitForWebsiteReconciliation = async () => {
	await waitFor(() => expect(getWebsite).toHaveBeenCalled());

	await act(async () => {
		await getWebsite.mock.results.at(-1)?.value;
	});
};

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
	mobileViewport.value = true;
	useWebsiteGenerationStore.setState(initialWebsiteGenerationState);
	chatSessionState.messages = [];
	chatSessionState.status = "ready";
	vi.clearAllMocks();
	blogPosts.mockReturnValue([]);
	mockUsePathname.mockReturnValue("/dashboard/website");
	getWebsite.mockResolvedValue(null);
	getAgentChat.mockResolvedValue({ chatId, messages: [] });

	controllerMock.mockReturnValue({
		additionActive: false,
		additionFailed: false,
		additionRecoverable: false,
		additionTarget: null,
		addSection: previewProps.onAddSection,
		brief,
		generate: vi.fn(),
		isLoading: false,
		phase: "ready",
		snapshot,
		stage: null,
		website: {
			brief,
			createdAt: "2026-08-14T12:00:00.000Z",
			id: websiteId,
			locale: "en",
			publication: { hasUnpublishedChanges: true, publishedAt: null },
			snapshot,
			updatedAt: "2026-08-14T12:00:00.000Z",
			workflow: null,
		},
		websiteId,
	});

	publishWebsite.mockResolvedValue({
		brief,
		createdAt: "2026-08-14T12:00:00.000Z",
		id: websiteId,
		locale: "en",
		publication: { hasUnpublishedChanges: false, publishedAt: "2026-08-15T14:00:00.000Z" },
		snapshot,
		updatedAt: "2026-08-15T14:00:00.000Z",
		workflow: null,
	});
});

describe("website setup and generation", () => {
	it("shows a quiet loading canvas before the first snapshot", () => {
		controllerMock.mockReturnValue({
			blocked: false,
			brief,
			generate: vi.fn(),
			isLoading: false,
			phase: "starting",
			reconnect: vi.fn(),
			recoverable: false,
			snapshot: null,
		});

		renderWebsitePage();

		expect(screen.getByRole("status", { name: "loading" })).toBeInTheDocument();
		expect(screen.queryByText("progress.preparing")).not.toBeInTheDocument();
		expect(screen.queryByText("stages.planning")).not.toBeInTheDocument();
		expect(screen.getByRole("combobox", { name: /^label:/u })).toBeDisabled();
		expect(screen.getByRole("button", { name: "desktop" })).toBeDisabled();
		expect(screen.getByRole("switch", { name: "preview" })).toHaveAttribute("aria-disabled", "true");
		expect(screen.getByRole("button", { name: "publish.open" })).toBeDisabled();
		expect(screen.queryByRole("button", { name: "form.submit" })).not.toBeInTheDocument();
		expect(document.querySelector("[data-purpose='details']")).not.toBeInTheDocument();
	});
});

describe("website generation preview", () => {
	it("mounts only the lean readiness preview during initial generation", () => {
		const view = render(<WebsiteGenerationPreview {...previewProps} phase='streaming' />);

		expect(sitePreviewRenderer).toHaveBeenLastCalledWith({
			disclosureItemControls: false,
			insertionGapComponent: false,
			linkElementProps: false,
			textElementProps: false,
		});

		expect(screen.queryByText("progress.preparing")).not.toBeInTheDocument();
		expect(screen.getByTestId("editable-action")).not.toHaveAttribute("data-website-inline-link");

		view.rerender(<WebsiteGenerationPreview {...previewProps} phase='ready' />);

		expect(sitePreviewRenderer).toHaveBeenLastCalledWith({
			disclosureItemControls: true,
			insertionGapComponent: true,
			linkElementProps: true,
			textElementProps: true,
		});

		expect(screen.getByTestId("editable-action")).toHaveAttribute("data-website-inline-link");
		expect(screen.getByTestId("editable-menu-link")).toHaveAttribute("data-website-menu-item");
		expect(screen.getByTestId("editable-menu-link")).not.toHaveAttribute("data-website-menu-edit-label");
	});

	it("scrolls the canvas to the top when the theme changes", () => {
		const view = render(<WebsiteGenerationPreview {...previewProps} />);
		const viewport = document.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");

		if (!viewport) {
			throw new Error("Expected the website canvas viewport");
		}

		viewport.scrollTop = 640;
		view.rerender(
			<WebsiteGenerationPreview {...previewProps} snapshot={{ ...snapshot, templateId: "artisan-craft" }} />
		);

		expect(viewport.scrollTop).toBe(0);
	});

	it("locks the canvas and publication while brand controls remain active in the page sidebar", async () => {
		const user = userEvent.setup();

		renderWebsitePage();
		await waitForWebsiteReconciliation();
		const publishButton = screen.getByRole("button", { name: "publish.open" });
		const languageSelect = screen.getByRole("combobox", { name: /^label:/u });
		const aboutLink = screen.getByRole("link", { name: "About" });

		expect(publishButton).toBeEnabled();
		await user.click(screen.getByRole("tab", { name: "page" }));
		await user.click(screen.getByRole("button", { name: /customize\.palette\.title/u }));

		expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "palette.title" })).toBeInTheDocument();
		expect(screen.getAllByRole("dialog")).toHaveLength(1);
		expect(publishButton).toBeDisabled();
		expect(languageSelect).toBeDisabled();
		screen.getAllByLabelText("palette.colors.primary").forEach((control) => expect(control).toBeEnabled());

		fireEvent.click(aboutLink);
		expect(useWebsiteGenerationStore.getState().pageId).toBeUndefined();
	});

	it("keeps language switching available while themes are open", async () => {
		const englishOnlySnapshot = structuredClone(snapshot);
		englishOnlySnapshot.document.locales = ["en"];
		delete englishOnlySnapshot.document.content.ar;
		const currentController = controllerMock();

		controllerMock.mockReturnValue({
			...currentController,
			snapshot: englishOnlySnapshot,
			website: { ...currentController.website, snapshot: englishOnlySnapshot },
		});

		const user = userEvent.setup();

		renderWebsitePage();
		await waitForWebsiteReconciliation();
		await user.click(screen.getByRole("tab", { name: "page" }));
		await user.click(screen.getByRole("button", { name: "templates.title" }));

		const languageSelect = screen.getByRole("combobox", { hidden: true, name: /^label:/u });
		expect(languageSelect).toBeEnabled();

		fireEvent.click(languageSelect);
		expect(screen.getAllByRole("option", { hidden: true })).toHaveLength(2);
	});

	it("locks the canvas and publication while the section catalog is open", async () => {
		renderWebsitePage();
		await waitForWebsiteReconciliation();

		act(() => {
			useWebsiteGenerationStore.getState().openCatalog({ target: { index: 1, pageId: aboutPageId } });
		});

		expect(screen.getByRole("button", { name: "publish.open" })).toBeDisabled();
		fireEvent.click(screen.getByRole("link", { name: "About" }));
		expect(useWebsiteGenerationStore.getState().pageId).toBeUndefined();
	});

	it("keeps the design-first website panel closed until customization is requested", async () => {
		const user = userEvent.setup();

		const { container } = renderWebsitePage();
		const detailsPanel = container.querySelector("[data-purpose='details']");
		const tabs = screen.getAllByRole("tab");
		const customize = screen.getByRole("button", { name: "sidebar.customize" });
		const pageSelector = screen.getByRole("combobox", { name: "pages.label: pages.home" });
		const languageSelector = screen.getByRole("combobox", { name: /^label:/u });

		if (!detailsPanel) {
			throw new Error("Expected the website details panel");
		}

		expect(detailsPanel).toHaveAttribute("data-side", "right");
		expect(detailsPanel).toHaveAttribute("data-state", "collapsed");
		expect(container.querySelector("[data-dashboard-editor]")).toBeInTheDocument();
		expect(screen.getByTestId("site-preview").compareDocumentPosition(detailsPanel)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING
		);
		expect(tabs.map((tab) => tab.textContent)).toEqual(["page", "agent"]);
		expect(screen.getByRole("tab", { name: "page" })).toHaveAttribute("aria-selected", "true");
		expect(screen.getByRole("heading", { name: "sidebar.pageTitle" })).toBeInTheDocument();
		expect(customize).not.toHaveTextContent("sidebar.customize");
		expect(customize.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
		expect(customize.querySelector("svg path")).toHaveAttribute("d", PaintBoardIcon[0][1].d);
		expect(pageSelector).toHaveTextContent("pages.label:");
		expect(pageSelector.compareDocumentPosition(languageSelector)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(customize.compareDocumentPosition(screen.getByRole("button", { name: "publish.open" }))).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING
		);

		await user.click(customize);

		expect(document.querySelector('[data-sidebar="sidebar"][data-mobile="true"]')).toHaveAttribute(
			"data-position",
			"bottom"
		);

		await user.click(within(screen.getByRole("dialog")).getByRole("tab", { name: "agent" }));
		expect(screen.getAllByTestId("website-agent-chat").length).toBeGreaterThan(0);
	});

	it("restores the navigation sidebar border marker after leaving the website editor", async () => {
		const view = renderWebsitePage();
		await waitForWebsiteReconciliation();

		expect(view.container.querySelector("[data-dashboard-editor]")).toBeInTheDocument();
		mockUsePathname.mockReturnValue("/dashboard");

		view.rerender(
			<QueryClientProvider client={new QueryClient()}>
				<WebsitePage />
			</QueryClientProvider>
		);
		await waitForWebsiteReconciliation();

		expect(view.container.querySelector("[data-dashboard-editor]")).not.toBeInTheDocument();
	});

	it("keeps the website canvas visible while the agent sidebar loads its history", async () => {
		const user = userEvent.setup();
		const agentChat = Promise.withResolvers<{ chatId: string; messages: [] }>();
		getAgentChat.mockReturnValueOnce(agentChat.promise);

		renderWebsitePage({ seedAgentChat: false });

		expect(screen.getByTestId("site-preview")).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "page" })).toHaveAttribute("aria-selected", "true");
		expect(screen.getByRole("heading", { name: "sidebar.pageTitle" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "customize.palette.title" })).toBeEnabled();
		expect(screen.queryByTestId("website-agent-loading")).not.toBeInTheDocument();
		expect(screen.queryByTestId("website-editor-loading")).not.toBeInTheDocument();

		await user.click(screen.getByRole("tab", { name: "agent" }));
		expect(screen.getByTestId("website-agent-loading")).toBeInTheDocument();

		agentChat.resolve({ chatId, messages: [] });
		await waitFor(() => expect(screen.queryByTestId("website-agent-loading")).not.toBeInTheDocument());
		expect(screen.getByTestId("website-agent-chat")).toBeInTheDocument();
	});

	it("keeps the website preview outside the themes button", async () => {
		renderWebsitePage();

		const themesButton = screen.getByRole("button", { name: "templates.title" });
		const themesPreview = await screen.findByTestId("site-renderer");

		expect(themesButton).not.toContainElement(themesPreview);
		expect(themesButton.parentElement).toContainElement(themesPreview);
	});

	it("focuses the website agent input for each AI edit request", async () => {
		const editor = { ...previewEditor, sidebarMode: "agent" as const };

		const props = {
			agentFocusRequest: 0,
			editor,
			onAddSection: vi.fn(),
			onChangeTemplate: vi.fn(),
			onGenerateLayout: vi.fn(),
			snapshot,
			websiteId,
		};

		const queryClient = new QueryClient();

		const view = render(
			<QueryClientProvider client={queryClient}>
				<SidebarProvider keyboardShortcut={false} purpose='details'>
					<WebsiteEditorSidebar {...props} />
				</SidebarProvider>
			</QueryClientProvider>
		);

		const input = screen.getByTestId("website-agent-chat");

		expect(input).not.toHaveFocus();

		view.rerender(
			<QueryClientProvider client={queryClient}>
				<SidebarProvider keyboardShortcut={false} purpose='details'>
					<WebsiteEditorSidebar {...props} agentFocusRequest={1} />
				</SidebarProvider>
			</QueryClientProvider>
		);

		await waitFor(() => expect(input).toHaveFocus());
	});

	it("binds the persistent website chat to the current editor page", async () => {
		useWebsiteGenerationStore.setState({ pageId: aboutPageId });

		renderWebsitePage();
		await waitForWebsiteReconciliation();

		expect(chatSessionProvider).toHaveBeenCalledWith({
			initialMessages: [],
			runtime: expect.objectContaining({
				chatId,
				websiteEditor: { locale: "en", pageSlug: "about", websiteId },
			}),
		});
	});

	it("binds the website agent to the selected page's active-locale slug", async () => {
		useWebsiteGenerationStore.setState({ pageId: aboutPageId });

		render(
			<QueryClientProvider client={new QueryClient()}>
				<WebsiteEditorAgentProvider
					chatId={chatId}
					initialMessages={[]}
					locale='ar'
					snapshot={localizedSnapshot}
					websiteId={websiteId}
				>
					<div />
				</WebsiteEditorAgentProvider>
			</QueryClientProvider>
		);

		await waitForWebsiteReconciliation();

		expect(chatSessionProvider).toHaveBeenCalledWith({
			initialMessages: [],
			runtime: expect.objectContaining({
				chatId,
				websiteEditor: { locale: "ar", pageSlug: "من-نحن", websiteId },
			}),
		});
	});

	it("reconciles authoritative website state when the agent provider mounts", async () => {
		const authoritativeWebsite = {
			brief,
			createdAt: "2026-08-14T12:00:00.000Z",
			id: websiteId,
			locale: "en",
			publication: { hasUnpublishedChanges: true, publishedAt: null },
			snapshot: localizedSnapshot,
			updatedAt: "2026-08-15T14:00:00.000Z",
			workflow: null,
		};

		const queryClient = new QueryClient();
		getWebsite.mockResolvedValue(authoritativeWebsite);

		render(
			<QueryClientProvider client={queryClient}>
				<WebsiteEditorAgentProvider
					chatId={chatId}
					initialMessages={[]}
					locale='en'
					snapshot={snapshot}
					websiteId={websiteId}
				>
					<div />
				</WebsiteEditorAgentProvider>
			</QueryClientProvider>
		);

		await waitFor(() => expect(useWebsiteGenerationStore.getState().snapshot).toBe(localizedSnapshot));
		expect(queryClient.getQueryData(["websites", "get"])).toEqual(authoritativeWebsite);
	});

	it("does not replace a newer cached website during reconciliation", async () => {
		const cachedWebsite = {
			brief,
			createdAt: "2026-08-14T12:00:00.000Z",
			id: websiteId,
			locale: "en",
			publication: { hasUnpublishedChanges: true, publishedAt: null },
			snapshot: localizedSnapshot,
			updatedAt: "2026-08-15T14:00:00.000Z",
			workflow: null,
		};

		const staleWebsite = {
			...cachedWebsite,
			snapshot,
			updatedAt: "2026-08-15T13:59:59.999Z",
		};

		const queryClient = new QueryClient();
		queryClient.setQueryData(["websites", "get"], cachedWebsite);
		getWebsite.mockResolvedValue(staleWebsite);

		render(
			<QueryClientProvider client={queryClient}>
				<WebsiteEditorAgentProvider
					chatId={chatId}
					initialMessages={[]}
					locale='en'
					snapshot={snapshot}
					websiteId={websiteId}
				>
					<div />
				</WebsiteEditorAgentProvider>
			</QueryClientProvider>
		);

		await waitFor(() => expect(useWebsiteGenerationStore.getState().snapshot).toBe(localizedSnapshot));
		expect(queryClient.getQueryData(["websites", "get"])).toBe(cachedWebsite);
	});

	it("keeps website controls available while initial reconciliation runs in the background", async () => {
		const reconciliation = Promise.withResolvers<null>();
		getWebsite.mockReturnValueOnce(reconciliation.promise);

		renderWebsitePage();

		expect(screen.getByRole("button", { name: "publish.open" })).toBeEnabled();
		expect(screen.getByRole("combobox", { name: /^label:/u })).toBeEnabled();
		expect(screen.getByRole("switch", { name: "preview" })).toBeEnabled();
		reconciliation.resolve(null);

		await waitFor(() => expect(screen.getByRole("button", { name: "publish.open" })).toBeEnabled());
	});

	it("ignores reconciliation results from a replaced website provider", async () => {
		const staleWebsite = {
			brief,
			createdAt: "2026-08-14T12:00:00.000Z",
			id: websiteId,
			locale: "en",
			publication: { hasUnpublishedChanges: true, publishedAt: null },
			snapshot,
			updatedAt: "2026-08-15T14:00:00.000Z",
			workflow: null,
		};

		const replacementWebsite = {
			...staleWebsite,
			id: replacementWebsiteId,
			snapshot: localizedSnapshot,
			updatedAt: "2026-08-15T15:00:00.000Z",
		};

		const staleReconciliation = Promise.withResolvers<typeof staleWebsite>();
		const queryClient = new QueryClient();
		getWebsite.mockReturnValueOnce(staleReconciliation.promise).mockResolvedValueOnce(replacementWebsite);

		const { rerender } = render(
			<QueryClientProvider client={queryClient}>
				<WebsiteEditorAgentProvider
					chatId={chatId}
					initialMessages={[]}
					locale='en'
					snapshot={snapshot}
					websiteId={websiteId}
				>
					<div />
				</WebsiteEditorAgentProvider>
			</QueryClientProvider>
		);

		await waitFor(() => expect(getWebsite).toHaveBeenCalledOnce());

		rerender(
			<QueryClientProvider client={queryClient}>
				<WebsiteEditorAgentProvider
					chatId={chatId}
					initialMessages={[]}
					locale='en'
					snapshot={localizedSnapshot}
					websiteId={replacementWebsiteId}
				>
					<div />
				</WebsiteEditorAgentProvider>
			</QueryClientProvider>
		);

		await waitFor(() => expect(queryClient.getQueryData(["websites", "get"])).toEqual(replacementWebsite));

		staleReconciliation.resolve(staleWebsite);
		await act(async () => staleReconciliation.promise);

		expect(queryClient.getQueryData(["websites", "get"])).toEqual(replacementWebsite);
	});

	it("locks website mutations until a data change is reconciled", async () => {
		renderWebsitePage();
		await waitForWebsiteReconciliation();
		const reconciliation = Promise.withResolvers<null>();
		getWebsite.mockReturnValueOnce(reconciliation.promise);
		act(() => notifyWebsiteChange());
		expect(screen.getByRole("button", { name: "publish.open" })).toBeDisabled();
		reconciliation.resolve(null);
		await waitFor(() => expect(screen.getByRole("button", { name: "publish.open" })).toBeEnabled());
	});

	it("publishes from the public-site panel", async () => {
		const user = userEvent.setup();

		renderWebsitePage();
		await waitForWebsiteReconciliation();

		expect(screen.queryByText("publication.status.draft")).not.toBeInTheDocument();
		const publishTrigger = screen.getByRole("button", { name: "publish.open" });
		expect(publishTrigger).toBeEnabled();

		await user.click(publishTrigger);
		expect(screen.getByText("publish.title")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "publish.action" }));
		expect(publishWebsite).toHaveBeenCalledOnce();
	});

	it.each(["test", "development"])(
		"shows the current website URL and published status in %s",
		async (environment) => {
			vi.stubEnv("NODE_ENV", environment);
			const currentController = controllerMock();
			controllerMock.mockReturnValue({
				...currentController,
				website: {
					...currentController.website,
					publication: { hasUnpublishedChanges: false, publishedAt: "2026-08-15T14:00:00.000Z" },
				},
			});
			const websitesUrl = "https://northstar.example";
			const user = userEvent.setup();

			renderWebsitePage({ websitesUrl });
			await user.click(screen.getByRole("button", { name: "publish.open" }));

			expect(screen.getAllByText("live")).toHaveLength(2);
			expect(screen.getByText("publish.upToDateDescription")).toBeInTheDocument();
			const expectedUrl = environment === "development" ? `http://${websiteId}.localhost:3001` : websitesUrl;
			expect(screen.getByTitle(expectedUrl)).toHaveTextContent(expectedUrl);
			expect(screen.getByRole("link", { name: expectedUrl })).toHaveAttribute("href", expectedUrl);
			expect(screen.getByRole("button", { name: "copyToClipboard" })).toBeEnabled();
			expect(screen.getByRole("button", { name: "upToDate" })).toBeDisabled();
			expect(screen.queryByText("viewSite")).not.toBeInTheDocument();
		}
	);

	it("selects the active website page from the editor toolbar", async () => {
		const user = userEvent.setup();

		renderWebsitePage();

		const pageSelector = screen.getByRole("combobox", { name: "pages.label: pages.home" });
		expect(pageSelector).toHaveTextContent("pages.home");

		await user.click(pageSelector);
		await user.click(await screen.findByRole("option", { name: "About" }));

		expect(useWebsiteGenerationStore.getState().pageId).toBe(aboutPageId);
		expect(pageSelector).toHaveAccessibleName("pages.label: About");
	});

	it("shows automatic Blog navigation in the editor without mutating the saved document", () => {
		const saved = structuredClone(snapshot.document);
		blogPosts.mockReturnValue([
			{
				coverAlt: "",
				coverImage: null,
				excerpt: "",
				id: "post",
				publishedAt: "2026-01-01",
				slug: "post",
				title: "Post",
			},
		]);
		render(<WebsiteGenerationPreview {...previewProps} />);
		expect(previewDocument).toHaveBeenLastCalledWith(withBlogNavigation(snapshot.document));
		expect(snapshot.document).toEqual(saved);
		fireEvent.click(screen.getByRole("link", { name: "Blog" }));
		expect(mockUseRouter.mock.results.at(-1)?.value.push).toHaveBeenCalledWith("/dashboard/blog");
		expect(previewEditor.edit).not.toHaveBeenCalled();
	});

	it("switches between editor and live rendering modes", async () => {
		const user = userEvent.setup();

		renderWebsitePage();

		expect(screen.getByTestId("site-preview")).toBeInTheDocument();
		const previewSwitch = screen.getByRole("switch", { name: "preview" });
		expect(previewSwitch).not.toBeChecked();
		expect(screen.getByRole("button", { name: "sidebar.customize" })).toBeInTheDocument();
		await user.click(previewSwitch);

		expect(previewSwitch).toBeChecked();
		expect(screen.queryByRole("button", { name: "sidebar.customize" })).not.toBeInTheDocument();

		expect(
			screen.getAllByTestId("site-renderer").find((renderer) => !renderer.closest("[aria-hidden='true']"))
		).toBeInTheDocument();

		expect(screen.queryByTestId("site-preview")).not.toBeInTheDocument();
		await user.click(screen.getByRole("link", { name: "About" }));

		expect(useWebsiteGenerationStore.getState().pageId).toBe(aboutPageId);

		expect(
			screen.getAllByTestId("site-renderer").find((renderer) => !renderer.closest("[aria-hidden='true']"))
		).toBeInTheDocument();

		await user.click(previewSwitch);
		expect(screen.getByTestId("site-preview")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "sidebar.customize" })).toBeInTheDocument();
	});

	it("starts preview on desktop and switches between responsive preview sizes", async () => {
		const user = userEvent.setup();
		mobileViewport.value = false;

		renderWebsitePage();
		const previewFrame = () => screen.getByRole("main");
		const previewSwitch = screen.getByRole("switch", { name: "preview" });

		expect(previewFrame()).toHaveAttribute("data-website-viewport", "desktop");
		expect(screen.queryByRole("button", { name: "tablet" })).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "sidebar.customize" })).toHaveTextContent("sidebar.customize");
		expect(screen.getByRole("button", { name: "publish.open" })).toHaveTextContent("publish.mobile");
		expect(screen.getByRole("combobox", { name: /^label:/u })).toHaveTextContent("label:");

		await user.click(previewSwitch);

		await user.click(screen.getByRole("button", { name: "tablet" }));

		expect(previewFrame()).toHaveAttribute("data-website-viewport", "tablet");

		await user.click(screen.getByRole("button", { name: "mobile" }));

		expect(previewFrame()).toHaveAttribute("data-website-viewport", "mobile");

		await user.click(previewSwitch);

		expect(previewFrame()).toHaveAttribute("data-website-viewport", "desktop");
		expect(screen.queryByRole("button", { name: "mobile" })).not.toBeInTheDocument();

		await user.click(previewSwitch);

		expect(previewFrame()).toHaveAttribute("data-website-viewport", "desktop");
	});

	it("keeps edit rendering on desktop when responsive preview state is stale", () => {
		render(<WebsiteGenerationPreview {...previewProps} viewport='mobile' />);

		expect(screen.getByTestId("site-preview").closest("[data-website-viewport]")).toHaveAttribute(
			"data-website-viewport",
			"desktop"
		);
	});

	it("edits action text in the link popover and closes it after cancel or save", async () => {
		const user = userEvent.setup();

		render(<WebsiteGenerationPreview {...previewProps} />);

		const action = screen.getByTestId("editable-action");
		const label = screen.getByTestId("editable-action-label");

		expect(label).not.toHaveAttribute("contenteditable");

		fireEvent.focus(action);
		expect(screen.queryByRole("button", { name: "cancel" })).not.toBeInTheDocument();

		await user.click(action);
		expect(screen.getByDisplayValue("Book now")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "cancel" }));
		await waitFor(() => expect(screen.queryByRole("button", { name: "cancel" })).not.toBeInTheDocument());

		await user.click(action);
		await user.clear(screen.getByDisplayValue("Book now"));
		await user.type(screen.getByLabelText("buttonText"), "Reserve");
		await user.click(screen.getByRole("button", { name: "save" }));

		expect(previewEditor.edit).toHaveBeenCalledWith({
			label: { pointers: ["/actions/items/action/label"], value: "Reserve" },
			locale: "en",
			operation: "update-link",
			pointer: "/actions/items/action/link",
			sectionId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d380",
			value: { kind: "external", url: "https://example.com" },
		});

		await waitFor(() => expect(screen.queryByRole("button", { name: "save" })).not.toBeInTheDocument());
	});

	it("opens editable links without navigating the canvas", async () => {
		const user = userEvent.setup();

		render(<WebsiteGenerationPreview {...previewProps} />);

		await user.click(screen.getByTestId("editable-menu-link"));

		expect(useWebsiteGenerationStore.getState().pageId).toBeUndefined();
		expect(screen.getByRole("button", { name: "cancel" })).toBeInTheDocument();
		expect(screen.getByText("title")).toBeInTheDocument();
		expect(screen.getByLabelText("label")).toHaveValue("Header About");
		expect(screen.getByText("kinds.link")).toBeInTheDocument();

		const itemType = screen.getAllByRole("combobox").at(0);

		if (!itemType) {
			throw new Error("Expected a menu item type control");
		}

		await user.click(itemType);
		await user.click(screen.getByRole("option", { name: "kinds.dropdown" }));
		expect(screen.getByDisplayValue("newItem")).toBeInTheDocument();

		await user.clear(screen.getByLabelText("label"));
		await user.type(screen.getByLabelText("label"), "Company");
		await user.click(screen.getByRole("button", { name: "save" }));

		expect(previewEditor.edit).toHaveBeenCalledWith({
			elementId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d384",
			items: [
				{
					id: expect.any(String),
					label: "newItem",
					value: { kind: "page", pageId: snapshot.document.structure.pages[0]?.id },
				},
			],
			kind: "dropdown",
			label: "Company",
			locale: "en",
			operation: "update-menu-item",
			sectionId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d380",
			value: { kind: "relative", path: "/about" },
		});
	});

	it("does not show an intermediate menu control on hover", async () => {
		const user = userEvent.setup();

		render(<WebsiteGenerationPreview {...previewProps} />);

		await user.hover(screen.getByTestId("editable-menu-link"));

		expect(screen.queryByRole("button", { name: "menu.edit" })).not.toBeInTheDocument();
	});

	it("keeps internal generation progress out of the customer UI while handling preview navigation", () => {
		useWebsiteGenerationStore.setState({
			sectionsCompleted: 2,
			sectionsTotal: 5,
			snapshot,
			websiteId,
			workflow: {
				cursor: "3",
				kind: "generation",
				phase: "streaming",
				runId: "run-generation",
				subscriptionVersion: 0,
			},
		});

		render(<WebsiteGenerationPreview {...previewProps} phase='streaming' />);

		expect(screen.queryByText("progress.sections")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("link", { name: "About" }));
		expect(useWebsiteGenerationStore.getState().pageId).toBe(aboutPageId);
		expect(screen.getByTestId("site-preview")).toHaveAttribute("data-page-slug", "about");

		fireEvent.keyDown(screen.getByRole("link", { name: "External" }), { key: "Enter" });
		expect(useWebsiteGenerationStore.getState().pageId).toBe(aboutPageId);
	});

	it("keeps localized internal navigation on the same page identity", () => {
		render(<WebsiteGenerationPreview {...previewProps} locale='ar' snapshot={localizedSnapshot} />);

		fireEvent.click(screen.getByRole("link", { name: "About" }));

		expect(useWebsiteGenerationStore.getState().pageId).toBe(aboutPageId);
		expect(screen.getByTestId("site-preview")).toHaveAttribute("data-page-slug", "من-نحن");
	});

	it("keeps the home route inside the editor", () => {
		useWebsiteGenerationStore.setState({ pageId: aboutPageId });
		render(<WebsiteGenerationPreview {...previewProps} />);

		fireEvent.click(screen.getByRole("link", { name: "Home" }));

		expect(useWebsiteGenerationStore.getState().pageId).toBe(homePageId);
	});

	it("freezes locale and page navigation while the agent awaits a response", async () => {
		chatSessionState.messages = [{}];
		renderWebsitePage();
		await waitForWebsiteReconciliation();

		fireEvent.click(screen.getByRole("link", { name: "About" }));

		expect(useWebsiteGenerationStore.getState().pageId).toBeUndefined();
		expect(screen.getByRole("combobox", { name: /^label:/u })).toBeDisabled();
	});

	it("uses the live renderer in preview mode while keeping internal navigation inside the editor", () => {
		render(<WebsiteGenerationPreview {...previewProps} mode='preview' />);

		expect(screen.getByTestId("site-renderer")).toBeInTheDocument();
		expect(screen.queryByTestId("site-preview")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("link", { name: "About" }));

		expect(useWebsiteGenerationStore.getState().pageId).toBe(aboutPageId);
		expect(screen.getByTestId("site-renderer")).toHaveAttribute("data-page-slug", "about");
	});

	it("offers retry after generation failure", async () => {
		const user = userEvent.setup();
		const onRetry = vi.fn().mockResolvedValue(undefined);

		useWebsiteGenerationStore.setState({
			snapshot,
			websiteId,
			workflow: {
				cursor: "4",
				kind: "generation",
				phase: "failed",
				runId: "run-generation",
				subscriptionVersion: 0,
			},
		});

		render(<WebsiteGenerationPreview {...previewProps} onRetry={onRetry} phase='failed' />);
		await user.click(screen.getByRole("button", { name: "failed.action" }));

		expect(onRetry).toHaveBeenCalledOnce();
	});

	it("surfaces an unknown attached workflow as a non-retryable blocker", () => {
		render(<WebsiteGenerationPreview {...previewProps} blocked phase='failed' />);

		expect(screen.getByRole("alert")).toHaveTextContent("blocked.title");
		expect(screen.getByRole("alert")).toHaveTextContent("blocked.description");
		expect(screen.queryByRole("button", { name: "failed.action" })).not.toBeInTheDocument();
	});

	it("reopens the catalog at the failed section target", async () => {
		const user = userEvent.setup();
		const target = { index: 2, pageId: snapshot.document.structure.pages[0]?.id ?? websiteId };

		render(<WebsiteGenerationPreview {...previewProps} additionFailed additionTarget={target} />);

		await user.click(screen.getByRole("button", { name: "sectionAddition.failed.action" }));

		expect(previewProps.onOpenSectionCatalog).toHaveBeenCalledWith({ target });
	});

	it("does not restart a terminally failed layout workflow from client-only context", () => {
		render(<WebsiteGenerationPreview {...previewProps} layoutGenerationFailed />);

		expect(screen.getByRole("alert")).toHaveTextContent("failed.title");
		expect(screen.queryByRole("button", { name: "failed.action" })).not.toBeInTheDocument();
	});
});

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));
