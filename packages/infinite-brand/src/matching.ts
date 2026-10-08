import type { BrandColors } from "./colors";
import { brandFontPairingScales } from "./fonts/pairing-scales";
import { brandFontPairingIds, brandFontPairings, type BrandFontPairingId, type BrandTypeScale } from "./fonts/pairings";
import { brandPalettePresets } from "./options";
import type { BrandFontRole } from "./typography";

export const brandColorNames = ["background", "neutral", "primary", "secondary", "tertiary"] as const;

export const findBrandPalettePreset = ({ colors }: { colors: Partial<BrandColors> | undefined }) =>
	brandPalettePresets.find((preset) => brandColorNames.every((name) => preset.colors[name] === colors?.[name]));

const areFontSelectionsEqual = ({
	left,
	right,
}: {
	left: BrandFontRole["default"] | undefined;
	right: BrandFontRole["default"] | undefined;
}) => {
	if (!left || !right || left.fontId !== right.fontId || left.weight !== right.weight) {
		return left === right;
	}

	const axisNames = new Set([...Object.keys(left.axes ?? {}), ...Object.keys(right.axes ?? {})]);

	return [...axisNames].every((axis) => left.axes?.[axis] === right.axes?.[axis]);
};

export const areBrandFontRolesEqual = ({ left, right }: { left: BrandFontRole; right: BrandFontRole }) => {
	if (!areFontSelectionsEqual({ left: left.default, right: right.default })) {
		return false;
	}

	return (["locales", "scripts"] as const).every((scope) => {
		const keys = new Set([...Object.keys(left[scope] ?? {}), ...Object.keys(right[scope] ?? {})]);

		return [...keys].every((key) =>
			areFontSelectionsEqual({ left: left[scope]?.[key], right: right[scope]?.[key] })
		);
	});
};

export const findBrandFontPairing = ({
	pairingIds = brandFontPairingIds,
	typography,
}: {
	pairingIds?: ReadonlyArray<BrandFontPairingId>;
	typography: { body: BrandFontRole; heading: BrandFontRole };
}) =>
	pairingIds.find(
		(pairingId) =>
			areBrandFontRolesEqual({ left: brandFontPairings[pairingId].heading, right: typography.heading }) &&
			areBrandFontRolesEqual({ left: brandFontPairings[pairingId].body, right: typography.body })
	);

const areBrandFontRolesDefaultEqual = ({ left, right }: { left: BrandFontRole; right: BrandFontRole }) =>
	left.default.fontId === right.default.fontId && left.default.weight === right.default.weight;

const emptyTypeScale: BrandTypeScale = {};

export const findBrandTypeScale = ({ typography }: { typography: { body: BrandFontRole; heading: BrandFontRole } }) => {
	const pairingId = brandFontPairingIds.find(
		(id) =>
			areBrandFontRolesDefaultEqual({ left: brandFontPairings[id].heading, right: typography.heading }) &&
			areBrandFontRolesDefaultEqual({ left: brandFontPairings[id].body, right: typography.body })
	);

	return pairingId ? brandFontPairingScales[pairingId] : emptyTypeScale;
};
