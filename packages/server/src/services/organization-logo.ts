import { eq } from "drizzle-orm";

import { db, organizations, type Transaction } from "@starter/db";
import { brandLogoScale, brandLogoSchema, type BrandLogo } from "@starter/infinite-brand";

import { findUnownedMediaUrls } from "./media";

export class OrganizationLogoNotFoundError extends Error {
	constructor() {
		super("The logo must be an image from this organization's library.");
		this.name = "OrganizationLogoNotFoundError";
	}
}

export const readOrganizationLogo = async ({
	executor = db,
	organizationId,
}: {
	executor?: Transaction | typeof db;
	organizationId: string;
}) => {
	const [organization] = await executor
		.select({ logo: organizations.logo })
		.from(organizations)
		.where(eq(organizations.id, organizationId))
		.limit(1);

	const parsed = brandLogoSchema.safeParse({ scale: brandLogoScale.default, src: organization?.logo });

	return parsed.success ? parsed.data : undefined;
};

export const saveOrganizationLogo = async ({
	executor = db,
	logo,
	organizationId,
}: {
	executor?: Transaction | typeof db;
	logo: BrandLogo | undefined;
	organizationId: string;
}) => {
	if (logo && (await findUnownedMediaUrls({ organizationId, urls: [logo.src] })).length > 0) {
		throw new OrganizationLogoNotFoundError();
	}

	await executor
		.update(organizations)
		.set({ logo: logo?.src ?? null })
		.where(eq(organizations.id, organizationId));
};
