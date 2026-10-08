import {
	areBrandFontRolesEqual,
	brandColorNames,
	brandPalettePresets,
	findBrandPalettePreset,
	type BrandFoundationV1,
	type BrandUpdate,
} from "@starter/infinite-brand";

export { brandPalettePresets as websiteBrandPalettePresets } from "@starter/infinite-brand";

export const areWebsiteBrandCustomizationsEqual = ({
	left,
	right,
}: {
	left: BrandFoundationV1;
	right: BrandFoundationV1;
}) => {
	return (
		brandColorNames.every((colorName) => left.colors[colorName] === right.colors[colorName]) &&
		left.corners.style === right.corners.style &&
		(left.buttons?.style ?? "solid") === (right.buttons?.style ?? "solid") &&
		left.logo?.src === right.logo?.src &&
		left.logo?.scale === right.logo?.scale &&
		areBrandFontRolesEqual({ left: left.typography.heading, right: right.typography.heading }) &&
		areBrandFontRolesEqual({ left: left.typography.body, right: right.typography.body })
	);
};

export const findWebsiteBrandRecommendation = ({
	probabilities,
	update,
}: {
	probabilities: Record<string, number> | null;
	update: BrandUpdate | null;
}) => {
	const topPalette = Object.entries(probabilities ?? {}).toSorted(([, left], [, right]) => right - left)[0]?.[0];

	return {
		corners: update?.cornerStyle ?? null,
		fonts: update?.fontPairingId ?? null,
		palette:
			findBrandPalettePreset({ colors: update?.colors })?.id ??
			brandPalettePresets.find(({ id }) => id === topPalette)?.id ??
			null,
	};
};
