import { formatHex } from "culori";

import {
	brandFontPairings,
	brandFoundationSchema,
	getBrandFont,
	type BrandCornerStyle,
	type BrandFontPairingId,
	type BrandFontRole,
	type BrandFoundationV1,
} from "@starter/infinite-brand";

import { templateColorGroups, type TemplateColorGroupId } from "./template-color-groups";

export type TemplateBrandControls = {
	backgroundColor: string;
	bodyWeight: number;
	colorGroup: TemplateColorGroupId;
	cornerStyle: BrandCornerStyle;
	fontPairing: BrandFontPairingId;
	headingWeight: number;
	neutralColor: string;
	primaryColor: string;
	secondaryColor: string;
	tertiaryColor: string;
};

const applySelectionWeight = ({ selection, weight }: { selection: BrandFontRole["default"]; weight: number }) => {
	const range = getBrandFont({ fontId: selection.fontId })?.weight;

	return {
		...selection,
		weight: range ? Math.min(range.max, Math.max(range.min, weight)) : weight,
	};
};

const applyFontWeight = ({ role, weight }: { role: BrandFontRole; weight: number }): BrandFontRole => {
	const nextRole: BrandFontRole = {
		...role,
		default: applySelectionWeight({ selection: role.default, weight }),
	};

	if (role.scripts) {
		nextRole.scripts = Object.fromEntries(
			Object.entries(role.scripts).map(([script, selection]) => [
				script,
				applySelectionWeight({ selection, weight }),
			])
		);
	}

	if (role.locales) {
		nextRole.locales = Object.fromEntries(
			Object.entries(role.locales).map(([locale, selection]) => [
				locale,
				applySelectionWeight({ selection, weight }),
			])
		);
	}

	return nextRole;
};

const normalizeColor = ({ fallback, value }: { fallback: string; value: string }) => {
	return formatHex(value) ?? fallback;
};

export const applyTemplateBrandControls = ({
	brand,
	controls,
}: {
	brand: BrandFoundationV1;
	controls: TemplateBrandControls;
}) => {
	const pairing = brandFontPairings[controls.fontPairing] ?? brand.typography;
	const selectedColors = templateColorGroups[controls.colorGroup]?.colors;

	return brandFoundationSchema.parse({
		...brand,
		colors:
			selectedColors ??
			({
				background: normalizeColor({ fallback: brand.colors.background, value: controls.backgroundColor }),
				neutral: normalizeColor({ fallback: brand.colors.neutral, value: controls.neutralColor }),
				primary: normalizeColor({ fallback: brand.colors.primary, value: controls.primaryColor }),
				secondary: normalizeColor({ fallback: brand.colors.secondary, value: controls.secondaryColor }),
				tertiary: normalizeColor({ fallback: brand.colors.tertiary, value: controls.tertiaryColor }),
			} satisfies BrandFoundationV1["colors"]),
		corners: { style: controls.cornerStyle },
		typography: {
			body: applyFontWeight({ role: pairing.body, weight: controls.bodyWeight }),
			catalogVersion: 1,
			heading: applyFontWeight({ role: pairing.heading, weight: controls.headingWeight }),
		},
	});
};
