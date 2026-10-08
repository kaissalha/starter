import { brandCornerStyles, brandFontPairings } from "@starter/infinite-brand";

import { templateColorGroups } from "./template-color-groups";
import { TemplateStoryPreview } from "./template-story-preview";

export const templateStoryArgTypes = {
	assets: { table: { disable: true } },
	backgroundColor: {
		control: { type: "color" },
		if: { arg: "colorGroup", eq: "custom" },
		name: "Background",
		table: { category: "Brand · Colors" },
	},
	bodyWeight: {
		control: { max: 900, min: 100, step: 100, type: "range" },
		name: "Body weight",
		table: { category: "Brand · Typography" },
	},
	brand: { table: { disable: true } },
	colorGroup: {
		control: {
			labels: Object.fromEntries(Object.entries(templateColorGroups).map(([id, group]) => [id, group.label])),
			type: "select",
		},
		name: "Colour group",
		options: Object.keys(templateColorGroups),
		table: { category: "Brand · Colors" },
	},
	content: { table: { disable: true } },
	cornerStyle: {
		control: { type: "inline-radio" },
		name: "Corners",
		options: brandCornerStyles,
		table: { category: "Brand · Shape" },
	},
	definition: { table: { disable: true } },
	fontPairing: {
		control: {
			labels: {
				editorial: "Editorial",
				minimal: "Minimal",
				modern: "Modern",
			},
			type: "inline-radio",
		},
		name: "Font pairing",
		options: Object.keys(brandFontPairings),
		table: {
			category: "Brand · Typography",
			type: { summary: "Minimal · Modern · Editorial" },
		},
	},
	headingWeight: {
		control: { max: 900, min: 100, step: 100, type: "range" },
		name: "Heading weight",
		table: { category: "Brand · Typography" },
	},
	locale: {
		control: {
			labels: { ar: "العربية", en: "English" },
			type: "inline-radio",
		},
		name: "Language",
		options: ["en", "ar"],
		table: { category: "Preview" },
	},
	neutralColor: {
		control: { type: "color" },
		if: { arg: "colorGroup", eq: "custom" },
		name: "Neutral",
		table: { category: "Brand · Colors" },
	},
	primaryColor: {
		control: { type: "color" },
		if: { arg: "colorGroup", eq: "custom" },
		name: "Primary",
		table: { category: "Brand · Colors" },
	},
	secondaryColor: {
		control: { type: "color" },
		if: { arg: "colorGroup", eq: "custom" },
		name: "Secondary",
		table: { category: "Brand · Colors" },
	},
	tertiaryColor: {
		control: { type: "color" },
		if: { arg: "colorGroup", eq: "custom" },
		name: "Tertiary",
		table: { category: "Brand · Colors" },
	},
} as const;

export const templateStoryMeta = {
	argTypes: templateStoryArgTypes,
	component: TemplateStoryPreview,
	parameters: { layout: "fullscreen" },
};
