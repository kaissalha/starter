import { beforeEach, describe, expect, it, vi } from "vitest";

import { brandFontPairings } from "@starter/infinite-brand";

const websiteMocks = vi.hoisted(() => {
	class WebsiteDraftNotFoundError extends Error {}

	class WebsiteMutationConflictError extends Error {}

	return {
		editWebsite: vi.fn(),
		getWebsite: vi.fn(),
		publishWebsite: vi.fn(),
		WebsiteDraftNotFoundError,
		WebsiteMutationConflictError,
	};
});

const organizationLogoMocks = vi.hoisted(() => ({ saveOrganizationLogo: vi.fn() }));

vi.mock("../../src/services/websites/service", () => websiteMocks);

vi.mock("../../src/services/organization-logo", () => organizationLogoMocks);

import { publishBrand, setBrandLogo, updateBrand } from "../../src/services/brands";

const brand = {
	colors: {
		background: "#ffffff",
		neutral: "#64748b",
		primary: "#2457d6",
		secondary: "#0f172a",
		tertiary: "#e2e8f0",
	},
	corners: { style: "rounded" as const },
	defaultLocale: "en",
	locales: ["en"],
	schemaVersion: 1 as const,
	typography: { catalogVersion: 1 as const, ...brandFontPairings.minimal },
};

const website = {
	id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
	publication: { hasUnpublishedChanges: false, publishedAt: "2026-08-21T12:00:00.000Z" },
	snapshot: { brand },
	updatedAt: "2026-08-22T12:00:00.000Z",
};

describe("Brand service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		websiteMocks.getWebsite.mockResolvedValue(website);
	});

	it("merges every editable Brand setting through the versioned website edit", async () => {
		websiteMocks.editWebsite.mockImplementation(async ({ inputs }) => ({
			...website,
			publication: { ...website.publication, hasUnpublishedChanges: true },
			snapshot: { brand: inputs[0].brand },
			updatedAt: "2026-08-22T12:01:00.000Z",
		}));

		const result = await updateBrand({
			expected: { revision: website.updatedAt },
			organizationId: "org-1",
			update: {
				colors: { primary: "#123456" },
				cornerStyle: "soft",
				fontPairingId: "editorial",
			},
		});

		expect(websiteMocks.editWebsite).toHaveBeenCalledWith({
			inputs: [
				{
					brand: {
						...brand,
						colors: { ...brand.colors, primary: "#123456" },
						corners: { style: "soft" },
						typography: { catalogVersion: 1, ...brandFontPairings.editorial },
					},
					operation: "update-brand",
				},
			],
			organizationId: "org-1",
			updatedAt: website.updatedAt,
			websiteId: website.id,
		});

		expect(result).toMatchObject({
			brand: {
				colors: { primary: "#123456" },
				corners: { style: "soft" },
				typography: brandFontPairings.editorial,
			},
			publication: { hasUnpublishedChanges: true },
		});
	});

	it("publishes the website revision containing the Brand", async () => {
		websiteMocks.publishWebsite.mockResolvedValue({
			...website,
			publication: { hasUnpublishedChanges: false, publishedAt: "2026-08-22T12:02:00.000Z" },
			updatedAt: "2026-08-22T12:02:00.000Z",
		});

		await publishBrand({
			expected: { revision: website.updatedAt },
			organizationId: "org-1",
		});

		expect(websiteMocks.publishWebsite).toHaveBeenCalledWith({
			organizationId: "org-1",
			updatedAt: website.updatedAt,
			websiteId: website.id,
		});
	});

	it("sets and removes the logo through the current website draft", async () => {
		const logo = { scale: 1.2, src: "https://store.public.blob.vercel-storage.com/logo.png" };
		websiteMocks.editWebsite.mockImplementation(async ({ inputs }) => ({
			...website,
			snapshot: { brand: inputs[0].brand },
		}));

		await expect(setBrandLogo({ logo, organizationId: "org-1" })).resolves.toEqual({ logo });
		websiteMocks.getWebsite.mockResolvedValue({ ...website, snapshot: { brand: { ...brand, logo } } });
		await expect(setBrandLogo({ logo: null, organizationId: "org-1" })).resolves.toEqual({ logo: null });

		expect(websiteMocks.editWebsite.mock.calls.map(([{ inputs }]) => inputs[0].brand)).toEqual([
			{ ...brand, logo },
			brand,
		]);
		expect(organizationLogoMocks.saveOrganizationLogo).not.toHaveBeenCalled();
	});

	it("saves the organization logo when no website exists yet", async () => {
		const logo = { scale: 1, src: "https://store.public.blob.vercel-storage.com/logo.png" };
		websiteMocks.getWebsite.mockResolvedValue(null);

		await expect(setBrandLogo({ logo, organizationId: "org-1" })).resolves.toEqual({ logo });

		expect(organizationLogoMocks.saveOrganizationLogo).toHaveBeenCalledWith({ logo, organizationId: "org-1" });
		expect(websiteMocks.editWebsite).not.toHaveBeenCalled();
	});

	it("rejects agent mutations when the inspected Brand revision is stale", async () => {
		const expected = { revision: "2026-08-22T11:59:00.000Z" };

		await expect(
			updateBrand({
				expected,
				organizationId: "org-1",
				update: { colors: { primary: "#123456" } },
			})
		).rejects.toBeInstanceOf(websiteMocks.WebsiteMutationConflictError);

		await expect(publishBrand({ expected, organizationId: "org-1" })).rejects.toBeInstanceOf(
			websiteMocks.WebsiteMutationConflictError
		);

		expect(websiteMocks.editWebsite).not.toHaveBeenCalled();
		expect(websiteMocks.publishWebsite).not.toHaveBeenCalled();
	});
});
