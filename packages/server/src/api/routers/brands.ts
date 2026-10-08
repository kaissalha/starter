import { openapi } from "@orpc/openapi";
import { z } from "zod";

import { brandLogoSchema, brandOptions, brandOptionsSchema, brandUpdateSchema } from "@starter/infinite-brand";
import { WebsiteEditError } from "@starter/infinite-website/editing";

import {
	brandStateSchema,
	getBrand,
	publishBrand,
	recommendBrandAppearance,
	setBrandLogo,
	updateBrand,
} from "../../services/brands";
import { OrganizationLogoNotFoundError } from "../../services/organization-logo";
import { WebsiteDraftNotFoundError, WebsiteMutationConflictError } from "../../services/websites/service";
import { organizationPermission, authedWithOrganization, publicApi } from "../base";

const brandRevisionFields = { revision: z.string().min(1) };

const updateBrandInputSchema = z.compile(
	z.strictObject({ ...brandRevisionFields, update: brandUpdateSchema }).meta({ id: "UpdateBrandInput" })
);

const publishBrandInputSchema = z.compile(z.strictObject(brandRevisionFields).meta({ id: "PublishBrandInput" }));

const get = authedWithOrganization
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "GET",
			operationId: "getBrand",
			path: "/brand",
			summary: "Get the current organization Brand foundation",
			tags: ["brands"],
		})
	)
	.errors({ NOT_FOUND: { message: "The organization does not have a Brand draft." } })
	.output(brandStateSchema)
	.handler(async ({ context, errors }) => {
		try {
			return await getBrand({ organizationId: context.organizationId });
		} catch (error) {
			if (error instanceof WebsiteDraftNotFoundError) {
				throw errors.NOT_FOUND();
			}

			throw error;
		}
	});

const listOptions = authedWithOrganization
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "GET",
			operationId: "listBrandOptions",
			path: "/brand/options",
			summary: "List available Brand font pairings and corner styles",
			tags: ["brands"],
		})
	)
	.output(brandOptionsSchema)
	.handler(() => brandOptions);

const update = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "PATCH",
			operationId: "updateBrand",
			path: "/brand",
			summary: "Update Brand colors, typography, or corners",
			tags: ["brands"],
		})
	)
	.errors({
		CONFLICT: { message: "The Brand draft changed or is busy." },
		NOT_FOUND: { message: "The organization does not have a Brand draft." },
	})
	.input(updateBrandInputSchema)
	.output(brandStateSchema)
	.handler(async ({ context, errors, input }) => {
		try {
			return await updateBrand({
				expected: { revision: input.revision },
				organizationId: context.organizationId,
				update: input.update,
			});
		} catch (error) {
			if (error instanceof WebsiteDraftNotFoundError) {
				throw errors.NOT_FOUND();
			}

			if (error instanceof WebsiteMutationConflictError) {
				throw errors.CONFLICT();
			}

			throw error;
		}
	});

const publish = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "POST",
			operationId: "publishBrand",
			path: "/brand/publish",
			summary: "Publish the website draft containing the current Brand",
			tags: ["brands"],
		})
	)
	.errors({
		CONFLICT: { message: "The Brand draft changed or is busy." },
		NOT_FOUND: { message: "The organization does not have a Brand draft." },
	})
	.input(publishBrandInputSchema)
	.output(brandStateSchema)
	.handler(async ({ context, errors, input }) => {
		try {
			return await publishBrand({ expected: input, organizationId: context.organizationId });
		} catch (error) {
			if (error instanceof WebsiteDraftNotFoundError) {
				throw errors.NOT_FOUND();
			}

			if (error instanceof WebsiteMutationConflictError) {
				throw errors.CONFLICT();
			}

			throw error;
		}
	});

const recommend = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "POST",
			operationId: "recommendBrandAppearance",
			path: "/brand/recommend",
			summary: "Recommend Brand presets for a natural-language appearance request",
			tags: ["brands"],
		})
	)
	.errors({ NOT_FOUND: { message: "The organization does not have a Brand draft." } })
	.input(
		z.compile(
			z
				.strictObject({ request: z.string().trim().min(1).max(2000) })
				.meta({ id: "RecommendBrandAppearanceInput" })
		)
	)
	.output(
		z.compile(
			z.strictObject({
				probabilities: z.record(z.string(), z.number()).nullable(),
				revision: z.string(),
				update: brandUpdateSchema.nullable(),
			})
		)
	)
	.handler(async ({ context, errors, input, signal }) => {
		try {
			const current = await getBrand({ organizationId: context.organizationId });

			const { probabilities, update } = await recommendBrandAppearance({
				abortSignal: signal,
				current: current.brand,
				request: input.request,
			});

			return { probabilities, revision: current.updatedAt, update };
		} catch (error) {
			if (error instanceof WebsiteDraftNotFoundError) {
				throw errors.NOT_FOUND();
			}

			throw error;
		}
	});

const brandLogoStateSchema = z.compile(
	z.strictObject({ logo: brandLogoSchema.nullable() }).meta({ id: "BrandLogoState" })
);

const setLogo = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "PUT",
			operationId: "setBrandLogo",
			path: "/brand/logo",
			summary: "Set or remove the business logo",
			tags: ["brands"],
		})
	)
	.errors({
		BAD_REQUEST: { message: "The logo must be an image from this organization's library." },
		CONFLICT: { message: "The Brand draft changed or is busy." },
	})
	.input(brandLogoStateSchema)
	.output(brandLogoStateSchema)
	.handler(async ({ context, errors, input }) => {
		try {
			return await setBrandLogo({ logo: input.logo, organizationId: context.organizationId });
		} catch (error) {
			if (error instanceof OrganizationLogoNotFoundError || error instanceof WebsiteEditError) {
				throw errors.BAD_REQUEST();
			}

			if (error instanceof WebsiteMutationConflictError) {
				throw errors.CONFLICT();
			}

			throw error;
		}
	});

export const brands = { get, listOptions, publish, recommend, setLogo, update };
