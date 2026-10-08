import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSeoGeoController } from "@/app/[locale]/dashboard/seo-geo/use-seo-geo-controller";

import { mockOrganizationPermissions, organizationPermissionState } from "../../../mocks/organization-permissions";

const mocks = vi.hoisted(() => ({ geoOverview: vi.fn(), seedGeoOverview: vi.fn() }));

vi.mock("next-intl", () => ({ useLocale: () => "en" }));

vi.mock("@/lib/auth-client", () => ({ authClient: {} }));

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		seo: {
			geoOverview: {
				queryOptions: ({ input }: { input: { locale: string } }) => ({
					queryFn: async () => undefined,
					queryKey: ["seo", "geo", input.locale],
				}),
			},
			overview: {
				queryOptions: () => ({
					queryFn: async () => ({
						issues: [],
						primaryDomain: null,
						publishedAt: null,
						websiteId: "website-1",
					}),
					queryKey: ["seo", "overview"],
				}),
			},
			searchConsole: {
				queryOptions: () => ({
					queryFn: async () => ({ status: "unavailable" }),
					queryKey: ["seo", "search"],
				}),
			},
		},
	},
	client: { seo: { geoOverview: mocks.geoOverview, seedGeoOverview: mocks.seedGeoOverview } },
}));

const business = { location: "Toronto", name: "North Studio" };

const sample = (result: { results: Array<string> } | null) => ({
	history: [],
	id: "question-1",
	mode: result ? "sample" : null,
	question: "Which studio?",
	result,
	source: "generated",
});

const seeded = { business, samples: [sample({ results: [] })] };

const render = () => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

	return renderHook(() => useSeoGeoController(), {
		wrapper: ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		),
	});
};

describe("useSeoGeoController", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.seedGeoOverview.mockResolvedValue(seeded);
	});

	it("seeds an empty overview for a writer", async () => {
		mocks.geoOverview.mockResolvedValue({ business, samples: [] });
		const { result } = render();

		await waitFor(() => expect(result.current.geo.data).toEqual(seeded));
		expect(mocks.seedGeoOverview).toHaveBeenCalledOnce();
		expect(mocks.seedGeoOverview.mock.calls[0]?.[0]).toEqual({ locale: "en" });
	});

	it("seeds when a question has no sampled answer", async () => {
		mocks.geoOverview.mockResolvedValue({ business, samples: [sample(null)] });
		const { result } = render();

		await waitFor(() => expect(result.current.geo.data).toEqual(seeded));
		expect(mocks.seedGeoOverview).toHaveBeenCalledOnce();
	});

	it("does not seed when every question is sampled", async () => {
		mocks.geoOverview.mockResolvedValue(seeded);
		const { result } = render();

		await waitFor(() => expect(result.current.geo.data).toEqual(seeded));
		expect(mocks.seedGeoOverview).not.toHaveBeenCalled();
	});

	it("never seeds for a read-only member", async () => {
		organizationPermissionState.role = "member";
		mocks.geoOverview.mockResolvedValue({ business, samples: [] });
		const { result } = render();

		await waitFor(() => expect(result.current.geo.data).toEqual({ business, samples: [] }));
		expect(mocks.seedGeoOverview).not.toHaveBeenCalled();
		expect(result.current.canWrite).toBe(false);
	});

	it("does not seed without a business", async () => {
		mocks.geoOverview.mockResolvedValue({ business: null, samples: [] });
		const { result } = render();

		await waitFor(() => expect(result.current.geo.data).toEqual({ business: null, samples: [] }));
		expect(mocks.seedGeoOverview).not.toHaveBeenCalled();
	});
});
