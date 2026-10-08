import type { ToolObserve } from "@mastra/core/tools";
import { z } from "zod";

import {
	applyBrandUpdate,
	brandFoundationSchema,
	brandPalettePresets,
	brandUpdateSchema,
	findBrandFontPairing,
	findBrandPalettePreset,
	type BrandFoundationV1,
	type BrandLogo,
	type BrandUpdate,
} from "@starter/infinite-brand";

import { evaluateDecision } from "../ai/decisions";
import { appearanceDecisionInstructions } from "../ai/prompts";
import { saveOrganizationLogo } from "./organization-logo";
import {
	WebsiteDraftNotFoundError,
	WebsiteMutationConflictError,
	editWebsite,
	getWebsite,
	publishWebsite,
} from "./websites/service";

export const brandStateSchema = z.compile(
	z
		.strictObject({
			brand: brandFoundationSchema,
			publication: z.strictObject({
				hasUnpublishedChanges: z.boolean(),
				publishedAt: z.string().nullable(),
			}),
			updatedAt: z.string(),
		})
		.meta({ id: "BrandState" })
);

export const brandRevisionExpectationSchema = z.compile(
	z.strictObject({ revision: z.string().min(1) }).meta({ id: "BrandRevisionExpectation" })
);

export const brandUpdateMutationSchema = z.compile(
	brandRevisionExpectationSchema.extend({ update: brandUpdateSchema }).meta({ id: "UpdateBrandInput" })
);

export type BrandRevisionExpectation = z.infer<typeof brandRevisionExpectationSchema>;

export type BrandState = z.infer<typeof brandStateSchema>;

const projectBrandState = (website: Awaited<ReturnType<typeof getWebsite>>): BrandState => {
	if (!website?.snapshot) {
		throw new WebsiteDraftNotFoundError();
	}

	return {
		brand: website.snapshot.brand,
		publication: website.publication,
		updatedAt: website.updatedAt,
	};
};

const getBrandMutationContext = async ({
	expected,
	organizationId,
}: {
	expected: BrandRevisionExpectation;
	organizationId: string;
}) => {
	const current = await getWebsite({ organizationId });

	if (!current?.snapshot) {
		throw new WebsiteDraftNotFoundError();
	}

	if (current.updatedAt !== expected.revision) {
		throw new WebsiteMutationConflictError();
	}

	return {
		brand: current.snapshot.brand,
		target: { revision: expected.revision, websiteId: current.id },
	};
};

export const getBrand = async ({ organizationId }: { organizationId: string }) => {
	return projectBrandState(await getWebsite({ organizationId }));
};

export const updateBrand = async ({
	expected,
	organizationId,
	update,
}: {
	expected: BrandRevisionExpectation;
	organizationId: string;
	update: BrandUpdate;
}) => {
	const { brand: existing, target } = await getBrandMutationContext({ expected, organizationId });

	const brand = applyBrandUpdate({ brand: existing, update: brandUpdateSchema.parse(update) });

	return projectBrandState(
		await editWebsite({
			inputs: [{ brand, operation: "update-brand" }],
			organizationId,
			updatedAt: target.revision,
			websiteId: target.websiteId,
		})
	);
};

export const setBrandLogo = async ({ logo, organizationId }: { logo: BrandLogo | null; organizationId: string }) => {
	const website = await getWebsite({ organizationId });

	if (!website?.snapshot) {
		await saveOrganizationLogo({ logo: logo ?? undefined, organizationId });

		return { logo };
	}

	const { logo: _current, ...brand } = website.snapshot.brand;

	const updated = await editWebsite({
		inputs: [{ brand: logo ? { ...brand, logo } : brand, operation: "update-brand" }],
		organizationId,
		updatedAt: website.updatedAt,
		websiteId: website.id,
	});

	return { logo: updated.snapshot?.brand.logo ?? null };
};

export const publishBrand = async ({
	expected,
	organizationId,
}: {
	expected: BrandRevisionExpectation;
	organizationId: string;
}) => {
	const { target } = await getBrandMutationContext({ expected, organizationId });

	return projectBrandState(
		await publishWebsite({
			organizationId,
			updatedAt: target.revision,
			websiteId: target.websiteId,
		})
	);
};

const describeBrandAppearance = (brand: BrandFoundationV1) => ({
	corners: brand.corners.style,
	fontPairing: findBrandFontPairing({ typography: brand.typography }) ?? "custom fonts",
	palette: findBrandPalettePreset({ colors: brand.colors })?.description ?? "custom colors chosen by the user",
});

const paletteChoices = Object.fromEntries([
	["keep", "Keep existing colors; no suitable preset or colors were not requested"],
	...brandPalettePresets.map(({ description, id }) => [id, description]),
]);

export const recommendBrandAppearance = async ({
	abortSignal,
	current,
	observe,
	request,
}: {
	abortSignal?: AbortSignal;
	current: BrandFoundationV1;
	observe?: Pick<ToolObserve, "span">;
	request: string;
}) => {
	const result = await evaluateDecision({
		abortSignal,
		functionId: "brand-appearance-recommendation",
		memoize: true,
		observe,
		questions: {
			corners: {
				criteria: {
					keep: "Keep existing corners; corners were not requested",
					rounded: "Rounded welcoming corners",
					soft: "Very soft playful corners",
					square: "Sharp square corners",
					subtle: "Slightly rounded, restrained corners",
				},
				instructions: appearanceDecisionInstructions,
				type: "choice",
			},
			font: {
				criteria: {
					editorial: "Classic expressive serif headings and serif body, literary and editorial",
					keep: "Keep current typography; no match or typography was not requested",
					minimal: "Clean understated sans-serif typography",
					modern: "Contemporary geometric sans-serif typography",
				},
				instructions: appearanceDecisionInstructions,
				type: "choice",
			},
			palette: {
				criteria: paletteChoices,
				instructions: appearanceDecisionInstructions,
				type: "choice",
			},
		},
		state: { current: describeBrandAppearance(current), request },
	});

	if (!result) {
		return { probabilities: null, update: null };
	}

	const { corners, font, palette } = result.answers;

	const update = brandUpdateSchema.safeParse({
		colors: brandPalettePresets.find(({ id }) => id === palette.choice)?.colors,
		cornerStyle: corners.choice === "keep" ? undefined : corners.choice,
		fontPairingId: font.choice === "keep" ? undefined : font.choice,
	});

	return { probabilities: palette.probabilities ?? null, update: update.success ? update.data : null };
};
