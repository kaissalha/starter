import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWebsiteTemplatePreview } from "@/app/[locale]/dashboard/website/editor/use-website-template-preview";
import { WebsiteTemplateSelector } from "@/app/[locale]/dashboard/website/editor/website-template-selector";
import {
	createGenerationTemplateBrand,
	createWebsiteGenerationShell,
	generationPageKeys,
	websiteGenerationProfiles,
} from "@starter/infinite-website/generation";
import { templatePreviews } from "@starter/infinite-website/template-previews";

import { mockOrganizationPermissions } from "../../mocks/organization-permissions";

const { listTemplates, previewTemplate, recommendTemplates } = vi.hoisted(() => ({
	listTemplates: vi.fn(),
	previewTemplate: vi.fn(),
	recommendTemplates: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		websites: {
			templateRecommendations: {
				queryOptions: (options: { retry: boolean; staleTime: number }) => ({
					...options,
					queryFn: recommendTemplates,
					queryKey: ["websites", "templateRecommendations"],
				}),
			},
			templates: {
				queryOptions: ({ staleTime }: { staleTime: number }) => ({
					queryFn: listTemplates,
					queryKey: ["websites", "templates"],
					staleTime,
				}),
			},
		},
	},
	client: { websites: { previewTemplate } },
}));

const websiteId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d";

const profiles = websiteGenerationProfiles.slice(0, 3);

const currentProfile = profiles[0];

const alternativeProfile = profiles[1];

const secondAlternativeProfile = profiles[2];

if (!currentProfile || !alternativeProfile || !secondAlternativeProfile) {
	throw new Error("Expected website generation profiles");
}

const generatedSnapshot = createWebsiteGenerationShell({
	brief: { location: "Toronto", name: "Northstar", schemaVersion: 1, type: "Design studio" },
	localizations: {
		byLocale: {
			en: {
				kind: "plan",
				pages: generationPageKeys.map((pageKey) => ({
					description: `${pageKey} description`,
					pageKey,
					title: pageKey,
				})),
				siteDescription: "Northstar studio",
			},
		},
		defaultLocale: "en" as const,
	},
	profile: currentProfile,
	websiteId,
});

const currentTemplatePreview = templatePreviews.find(({ id }) => id === currentProfile.templateId);

if (!currentTemplatePreview) {
	throw new Error("Expected the current template preview");
}

const snapshot = {
	...generatedSnapshot,
	assets: currentTemplatePreview.assets,
	document: currentTemplatePreview.document,
};

const alternatives = profiles.map((profile) => ({
	description: `${profile.name} description`,
	id: profile.templateId,
	name: profile.name,
	preview: {
		assets: templatePreviews.find(({ id }) => id === profile.templateId)?.assets ?? {},
		brand: createGenerationTemplateBrand({ locale: "en", profile }),
		document: {
			...snapshot.document,
			structure: {
				layout: { footer: [], header: [] },
				pages: snapshot.document.structure.pages.map((page) => ({ ...page, sections: [] })),
			},
		},
		schemaVersion: 1 as const,
		templateId: profile.templateId,
	},
	tags: [],
}));

const alternativeSkeleton = { ...snapshot, assets: {}, templateId: alternativeProfile.templateId };

const generatedAlternative = { ...alternativeSkeleton, assets: snapshot.assets };

const secondAlternativeSkeleton = { ...snapshot, assets: {}, templateId: secondAlternativeProfile.templateId };

const generatedSecondAlternative = { ...secondAlternativeSkeleton, assets: snapshot.assets };

const renderTemplateSelector = (props: Partial<Parameters<typeof WebsiteTemplateSelector>[0]> = {}) =>
	render(
		<QueryClientProvider client={new QueryClient()}>
			<WebsiteTemplateSelector
				locale='en'
				onApply={vi.fn()}
				onCancel={vi.fn()}
				onPreview={vi.fn()}
				snapshot={snapshot}
				websiteId={websiteId}
				{...props}
			/>
		</QueryClientProvider>
	);

const renderGeneratedPreview = async (onPreview: Parameters<typeof WebsiteTemplateSelector>[0]["onPreview"]) => {
	const user = userEvent.setup();
	renderTemplateSelector({ onPreview });
	await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(alternatives.length));
	await user.click(screen.getByRole("radio", { name: alternativeProfile.name }));
	await waitFor(() => expect(previewTemplate).toHaveBeenCalledTimes(2));

	return user;
};

describe("website template selector", () => {
	beforeEach(() => {
		listTemplates.mockClear();
		previewTemplate.mockClear();
		recommendTemplates.mockReset();
		recommendTemplates.mockResolvedValue({ templateIds: [] });
		listTemplates.mockResolvedValue(alternatives);
		previewTemplate.mockImplementation(
			async ({ mode, templateId }: { mode: "generated" | "skeleton"; templateId: string }) => {
				const isSecondAlternative = templateId === secondAlternativeProfile.templateId;

				if (mode === "skeleton") {
					return isSecondAlternative ? secondAlternativeSkeleton : alternativeSkeleton;
				}

				return isSecondAlternative ? generatedSecondAlternative : generatedAlternative;
			}
		);
	}, 30_000);

	it("lists templates immediately and moves recommended templates first with a badge once known", async () => {
		const recommendation = Promise.withResolvers<{ templateIds: Array<string> }>();
		recommendTemplates.mockReturnValue(recommendation.promise);
		renderTemplateSelector();

		await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(alternatives.length));
		expect(screen.getAllByRole("radio")[0]).toHaveAccessibleName(currentProfile.name);
		expect(screen.queryByText("recommended")).not.toBeInTheDocument();

		recommendation.resolve({ templateIds: [secondAlternativeProfile.templateId, alternativeProfile.templateId] });

		await waitFor(() => expect(screen.getAllByText("recommended")).toHaveLength(2));

		const labels = [...document.querySelectorAll<HTMLElement>("[data-template-id]")].map(
			({ dataset }) => dataset.templateId
		);

		expect(labels).toEqual([
			secondAlternativeProfile.templateId,
			alternativeProfile.templateId,
			currentProfile.templateId,
		]);
		expect(document.querySelector(`[data-template-id="${currentProfile.templateId}"]`)?.textContent).not.toContain(
			"recommended"
		);
	});

	it("keeps selector thumbnails untouched and generates the selected website preview", async () => {
		const onApply = vi.fn().mockResolvedValue(undefined);
		const onPreview = vi.fn();
		const user = userEvent.setup();

		render(
			<QueryClientProvider client={new QueryClient()}>
				<WebsiteTemplateSelector
					locale='en'
					onApply={onApply}
					onCancel={vi.fn()}
					onPreview={onPreview}
					snapshot={snapshot}
					websiteId={websiteId}
				/>
			</QueryClientProvider>
		);

		await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(alternatives.length));
		expect(
			screen.queryByText(
				"Choose a full-site template. Applying it rebuilds the draft around your business brief."
			)
		).not.toBeInTheDocument();
		const alternativeRadio = screen.getByRole("radio", { name: alternativeProfile.name });
		expect(
			[...(alternativeRadio.closest("label")?.children ?? [])].filter(
				(element) => element.tagName === "SPAN" && !element.classList.contains("sr-only")
			)
		).toHaveLength(0);
		await user.click(alternativeRadio);

		await waitFor(() =>
			expect(previewTemplate).toHaveBeenNthCalledWith(
				1,
				{
					locale: "en",
					mode: "skeleton",
					templateId: alternativeProfile.templateId,
					websiteId,
				},
				expect.objectContaining({ signal: expect.any(AbortSignal) })
			)
		);
		expect(onPreview.mock.calls[0]?.[0]).toBe(alternativeSkeleton);
		expect(onPreview).not.toHaveBeenCalledWith(alternatives[1]?.preview);
		expect(previewTemplate).toHaveBeenNthCalledWith(
			2,
			{
				locale: "en",
				mode: "generated",
				templateId: alternativeProfile.templateId,
				websiteId,
			},
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
		await waitFor(() => expect(onPreview).toHaveBeenLastCalledWith(generatedAlternative));

		await user.click(screen.getByRole("button", { name: "done" }));
		expect(onApply).toHaveBeenCalledWith(alternativeProfile.templateId);
	}, 30_000);

	it("generates the selected locale and reuses previews on template revisits", async () => {
		const queryClient = new QueryClient();
		const onPreview = vi.fn();
		const user = userEvent.setup();

		const renderSelector = (locale: "ar" | "en") => (
			<QueryClientProvider client={queryClient}>
				<WebsiteTemplateSelector
					locale={locale}
					onApply={vi.fn()}
					onCancel={vi.fn()}
					onPreview={onPreview}
					snapshot={snapshot}
					websiteId={websiteId}
				/>
			</QueryClientProvider>
		);

		const view = render(renderSelector("en"));

		await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(alternatives.length));
		await user.click(screen.getByRole("radio", { name: alternativeProfile.name }));
		await waitFor(() => expect(previewTemplate).toHaveBeenCalledTimes(2));

		view.rerender(renderSelector("ar"));
		await waitFor(() => expect(previewTemplate).toHaveBeenCalledTimes(4));

		await user.click(screen.getByRole("radio", { name: secondAlternativeProfile.name }));
		await waitFor(() => expect(previewTemplate).toHaveBeenCalledTimes(6));
		await user.click(screen.getByRole("radio", { name: alternativeProfile.name }));

		await waitFor(() => expect(onPreview).toHaveBeenLastCalledWith(generatedAlternative));
		expect(previewTemplate).toHaveBeenCalledTimes(6);
	}, 60_000);

	it("regenerates a cached template when the baseline draft images change", async () => {
		const queryClient = new QueryClient();
		const user = userEvent.setup();

		const renderSelector = (currentSnapshot: typeof snapshot) =>
			render(
				<QueryClientProvider client={queryClient}>
					<WebsiteTemplateSelector
						locale='en'
						onApply={vi.fn()}
						onCancel={vi.fn()}
						onPreview={vi.fn()}
						snapshot={currentSnapshot}
						websiteId={websiteId}
					/>
				</QueryClientProvider>
			);

		const first = renderSelector(snapshot);

		await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(alternatives.length));
		await user.click(screen.getByRole("radio", { name: alternativeProfile.name }));
		await waitFor(() => expect(previewTemplate).toHaveBeenCalledTimes(2));
		first.unmount();

		const updatedSnapshot = {
			...snapshot,
			assets: { ...snapshot.assets, draft: { src: "/updated-draft.jpg" } },
		};

		renderSelector(updatedSnapshot);

		await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(alternatives.length));
		await user.click(screen.getByRole("radio", { name: alternativeProfile.name }));
		await waitFor(() => expect(previewTemplate).toHaveBeenCalledTimes(4));
		expect(previewTemplate).toHaveBeenNthCalledWith(
			3,
			{
				locale: "en",
				mode: "skeleton",
				templateId: alternativeProfile.templateId,
				websiteId,
			},
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
	});

	it("keeps the pending preview mounted until generated copy resolves", async () => {
		const onPreview = vi.fn();
		const generatedPreview = Promise.withResolvers<typeof generatedAlternative>();
		previewTemplate.mockImplementation(async ({ mode }: { mode: "generated" | "skeleton" }) => {
			if (mode === "generated") {
				return generatedPreview.promise;
			}

			return alternativeSkeleton;
		});

		await renderGeneratedPreview(onPreview);
		expect(onPreview).toHaveBeenLastCalledWith(alternativeSkeleton);
		expect(screen.getByRole("radio", { name: alternativeProfile.name })).toBeChecked();

		generatedPreview.resolve(generatedAlternative);
		await waitFor(() => expect(onPreview).toHaveBeenLastCalledWith(generatedAlternative));
	}, 30_000);

	it("does not revive explicitly cancelled preview work when the locale changes", async () => {
		const pending = Promise.withResolvers<typeof generatedAlternative>();
		previewTemplate.mockImplementation(({ mode }: { mode: string }) =>
			mode === "skeleton" ? Promise.resolve(alternativeSkeleton) : pending.promise
		);
		const queryClient = new QueryClient();
		const onPreview = vi.fn();

		const { rerender, result } = renderHook(
			({ locale }: { locale: "ar" | "en" }) =>
				useWebsiteTemplatePreview({ baselineSnapshot: snapshot, locale, onPreview, websiteId }),
			{
				initialProps: { locale: "en" },
				wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
			}
		);

		act(() => result.current.previewTemplate(alternativeProfile.templateId));
		await waitFor(() => expect(previewTemplate).toHaveBeenCalledTimes(2));
		act(() => result.current.abortPreview());
		rerender({ locale: "ar" });
		pending.resolve(generatedAlternative);
		await act(async () => {
			await pending.promise;
		});
		expect(previewTemplate).toHaveBeenCalledTimes(2);
		expect(onPreview).toHaveBeenLastCalledWith(alternativeSkeleton);
	});

	it("aborts obsolete generation when the preview is cancelled", async () => {
		const pending = Promise.withResolvers<typeof generatedAlternative>();
		previewTemplate.mockImplementation(({ mode }: { mode: string }) =>
			mode === "skeleton" ? Promise.resolve(alternativeSkeleton) : pending.promise
		);
		const onPreview = vi.fn();
		const user = await renderGeneratedPreview(onPreview);
		const signal = previewTemplate.mock.calls[1]?.[1].signal;
		expect(signal.aborted).toBe(false);
		await user.click(screen.getByRole("button", { name: "cancel" }));
		expect(signal.aborted).toBe(true);
		pending.resolve(generatedAlternative);
		await pending.promise;
		expect(onPreview).toHaveBeenLastCalledWith(alternativeSkeleton);
	}, 30_000);
});

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));
