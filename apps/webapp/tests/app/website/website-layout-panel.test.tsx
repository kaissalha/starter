import { act, type ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as renderComponent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WebsiteLayoutPanel } from "@/app/[locale]/dashboard/website/editor/website-layout-panel";
import { entityIdFromSeed, instantiateTemplate } from "@starter/infinite-website";
import { createWebsiteSectionLayoutPreview, readWebsiteSectionLayoutContent } from "@starter/infinite-website/editing";
import {
	createWebsiteGenerationShell,
	generationPageKeys,
	selectWebsiteGenerationProfile,
} from "@starter/infinite-website/generation";
import { nordicEdgeTemplate } from "@starter/infinite-website/templates/nordic-edge";
import nordicEdgeContent from "@starter/infinite-website/templates/nordic-edge/content";

import { mockOrganizationPermissions } from "../../mocks/organization-permissions";

const { previewLayout } = vi.hoisted(() => ({ previewLayout: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		websites: {
			get: { queryKey: () => ["websites", "get"] },
			previewLayout: {
				queryOptions: ({
					input,
					...options
				}: {
					gcTime: number;
					input: { pattern: string };
					retry: boolean;
					staleTime: number;
				}) => ({ ...options, queryFn: () => previewLayout(input), queryKey: ["previewLayout", input] }),
			},
		},
	},
	client: { websites: { previewLayout } },
}));

const render = (children: ReactNode) =>
	renderComponent(<QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>);

const websiteId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d";

const baseSnapshot = createWebsiteGenerationShell({
	brief: { location: "Toronto", name: "Northstar", schemaVersion: 1, type: "Design studio" },
	localizations: {
		byLocale: {
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
	profile: selectWebsiteGenerationProfile({ businessType: "Design studio" }),
	websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
});

const snapshot = {
	...baseSnapshot,
	document: instantiateTemplate({
		content: nordicEdgeContent,
		createId: ({ kind, path }: { kind: string; path: string }) =>
			entityIdFromSeed({ seed: `layout-panel:${kind}:${path}` }),
		definition: nordicEdgeTemplate,
		path: "/layout-panel",
	}),
};

const page = snapshot.document.structure.pages[0];

const section = page?.sections.find(({ anchor }) => anchor === "banner-card-and-background-image");

if (!page || !section) {
	throw new Error("Expected a hero layout target");
}

const target = { area: "page" as const, index: page.sections.indexOf(section), pageId: page.id, sectionId: section.id };

const cancelDraft = vi.fn();

const closeDraft = vi.fn();

const commitDraft = vi.fn();

const generate = vi.fn();

const previewDraft = vi.fn();

const createEditor = ({ selection }: { selection: string }) => {
	const previewDocument = createWebsiteSectionLayoutPreview({
		document: snapshot.document,
		pattern: selection,
		target,
	});

	const previewSnapshot = previewDocument ? { ...snapshot, document: previewDocument } : snapshot;

	return {
		cancelDraft,
		closeDraft,
		commitDraft,
		disabled: false,
		draft: { baselineSnapshot: snapshot, input: null, selection, snapshot: previewSnapshot },
		edit: vi.fn(),
		layoutTarget: target,
		locale: "en" as const,
		mediaTarget: null,
		mode: "edit" as const,
		openOverlay: vi.fn(),
		overlay: "layout" as const,
		pending: null,
		previewDraft,
		publish: vi.fn(),
		publishing: false,
		setState: vi.fn(),
		sidebarMode: "page" as const,
		viewport: "desktop" as const,
	};
};

describe("website layout panel", () => {
	beforeEach(() => {
		cancelDraft.mockReset();
		closeDraft.mockReset();
		commitDraft.mockReset();
		generate.mockReset();
		previewDraft.mockReset();
		previewLayout.mockReset();
		previewLayout.mockImplementation(() => new Promise(() => {}));
	});

	it("renders the first visible candidates immediately without mounting every preview", async () => {
		const user = userEvent.setup();

		render(
			<WebsiteLayoutPanel
				editor={createEditor({ selection: section.source?.pattern ?? "" })}
				onGenerate={generate}
				websiteId={websiteId}
			/>
		);

		expect(screen.getAllByRole("radio")).toHaveLength(4);
		await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(20), { timeout: 5000 });

		const radios = screen.getAllByRole("radio");

		const generatedOption = radios.find(
			(radio) => radio.closest("label")?.querySelector('input[value="banner-double-carousel"]') !== null
		);

		expect(document.querySelectorAll(".website-container")).toHaveLength(4);

		if (!generatedOption) {
			throw new Error("Expected a generated layout option");
		}

		await user.click(generatedOption.closest("label")!);

		expect(previewDraft).toHaveBeenCalledWith({
			input: null,
			selection: "banner-double-carousel",
			snapshot: expect.any(Object),
		});

		const previewSnapshot = previewDraft.mock.calls[0]?.[0].snapshot;
		const previewSection = previewSnapshot?.document.structure.pages[0]?.sections[target.index];

		expect(previewSection?.source.pattern).toBe("banner-double-carousel");
		expect(JSON.stringify(previewSnapshot)).not.toContain('"—"');
		await waitFor(() =>
			expect(previewLayout).toHaveBeenCalledWith(
				expect.objectContaining({
					locale: "en",
					pattern: "banner-double-carousel",
					snapshot,
					target,
					websiteId,
				}),
				expect.objectContaining({ signal: expect.any(AbortSignal) })
			)
		);
	});

	it("replaces pending copy with the generated preview", async () => {
		const user = userEvent.setup();
		const pending = Promise.withResolvers<typeof snapshot>();
		previewLayout.mockReturnValue(pending.promise);

		const view = render(
			<WebsiteLayoutPanel
				editor={createEditor({ selection: section.source?.pattern ?? "" })}
				onGenerate={generate}
				websiteId={websiteId}
			/>
		);

		await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(20), { timeout: 5000 });
		const option = document.querySelector('label[data-layout-pattern="banner-double-carousel"]');

		if (!option) {
			throw new Error("Missing layout option");
		}

		await user.click(option);
		const generated = { ...snapshot, templateId: "generated-preview" };
		await act(async () => pending.resolve(generated));
		expect(previewDraft).toHaveBeenLastCalledWith({
			input: null,
			selection: "banner-double-carousel",
			snapshot: generated,
		});
		const late = Promise.withResolvers<typeof snapshot>();
		previewLayout.mockReturnValue(late.promise);
		const nextOption = document.querySelector('label[data-layout-pattern="banner-compact-background"]');

		if (!nextOption) {
			throw new Error("Missing second layout option");
		}

		await user.click(nextOption);
		view.unmount();
		const calls = previewDraft.mock.calls.length;
		await act(async () => late.resolve(snapshot));
		expect(previewDraft).toHaveBeenCalledTimes(calls);
	});

	it("keeps the optimistic layout while starting generated layout work", async () => {
		const user = userEvent.setup();
		const editor = createEditor({ selection: "banner-double-carousel" });
		const content = readWebsiteSectionLayoutContent({ document: editor.draft.snapshot.document, target });
		const localized = content?.locales[editor.draft.snapshot.document.defaultLocale];
		const assetIds = [...new Set(localized?.assets.map(({ value }) => value) ?? [])];

		render(<WebsiteLayoutPanel editor={editor} onGenerate={generate} websiteId={websiteId} />);

		await user.click(screen.getByRole("button", { name: "done" }));

		expect(closeDraft).toHaveBeenCalledOnce();
		expect(cancelDraft).not.toHaveBeenCalled();

		expect(generate).toHaveBeenCalledWith({
			assetIds,
			baseSnapshot: snapshot,
			pattern: "banner-double-carousel",
			snapshot: editor.draft.snapshot,
			target,
		});

		expect(commitDraft).not.toHaveBeenCalled();
	});
});

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));
