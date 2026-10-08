import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { brandLogoScale, brandOptions, brandPalettePresets, brandUpdateSchema } from "@starter/infinite-brand";

import { getBrand, publishBrand, recommendBrandAppearance, setBrandLogo, updateBrand } from "../../services/brands";
import { getLibraryAsset } from "../../services/library";
import { requireOrganizationPermission } from "../../services/permissions";
import { appContextSchema } from "../types";

export const brandTools = {
	getBrand: createTool({
		description:
			"Get the active organization's current Brand foundation, publication state, and revision. Use that revision for one updateBrand or publishBrand call in the same turn.",
		execute: async (_input, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "read" });

			return getBrand({ organizationId: requestContext.get("organizationId") });
		},
		id: "get-brand",
		inputSchema: z.compile(z.object({})),
		requestContextSchema: appContextSchema,
	}),
	listBrandOptions: createTool({
		description:
			"List every supported Brand font pairing and corner style. Use this before proposing or applying typography and corner changes.",
		execute: async (_input, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "read" });

			return {
				cornerStyles: brandOptions.cornerStyles,
				fontPairings: Object.entries(brandOptions.fontPairings).map(([id, pairing]) => ({
					body: pairing.body.default.fontId,
					heading: pairing.heading.default.fontId,
					id,
				})),
				palettes: brandPalettePresets,
			};
		},
		id: "list-brand-options",
		inputSchema: z.compile(z.object({})),
		requestContextSchema: appContextSchema,
	}),
	publishBrand: createTool({
		description:
			"Publish the inspected website draft containing the active organization's Brand. Use the revision from a getBrand result returned in the same turn; all changes in that exact draft become live.",
		execute: async ({ revision }, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });

			return {
				revision: (
					await publishBrand({ expected: { revision }, organizationId: requestContext.get("organizationId") })
				).updatedAt,
			};
		},
		id: "publish-brand",
		inputSchema: z.compile(z.strictObject({ revision: z.string().min(1) })),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	recommendBrandAppearance: createTool({
		description:
			"Recommend approved Brand presets for a natural-language appearance request. Returns a bounded update for review, without saving. Use getBrand then approval-gated updateBrand to apply. Explicit preset choices need no recommendation call.",
		execute: async ({ request }, { abortSignal, observe, requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "read" });
			const current = await getBrand({ organizationId: requestContext.get("organizationId") });

			const { update } = await recommendBrandAppearance({
				abortSignal,
				current: current.brand,
				observe,
				request,
			});

			return { revision: current.updatedAt, update };
		},
		id: "recommend-brand-appearance",
		inputSchema: z.compile(z.strictObject({ request: z.string().trim().min(1).max(2000) })),
		requestContextSchema: appContextSchema,
	}),
	setBrandLogo: createTool({
		description:
			"Set the business logo shown on the website header and footer and as the Links profile image fallback, using an exact Library image ID, or pass null to show the business name as text. Saves to the drafts without publishing. Requires approval.",
		execute: async ({ assetId }, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });
			const organizationId = requestContext.get("organizationId");
			const asset = assetId ? await getLibraryAsset({ assetId, organizationId }) : null;

			if (asset && (asset.kind !== "image" || asset.access !== "public" || !asset.url)) {
				throw new Error("The logo must be a Library image.");
			}

			return setBrandLogo({
				logo: asset?.url ? { scale: brandLogoScale.default, src: asset.url } : null,
				organizationId,
			});
		},
		id: "set-brand-logo",
		inputSchema: z.compile(z.strictObject({ assetId: z.uuid().nullable() })),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	updateBrand: createTool({
		description:
			"Update the inspected Brand's colors, preset font pairing, or corner style without publishing. Use the revision from a getBrand result returned in the same turn.",
		execute: async ({ revision, update }, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });

			return {
				revision: (
					await updateBrand({
						expected: { revision },
						organizationId: requestContext.get("organizationId"),
						update,
					})
				).updatedAt,
			};
		},
		id: "update-brand",
		inputSchema: z.compile(z.strictObject({ revision: z.string().min(1), update: brandUpdateSchema })),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
};
