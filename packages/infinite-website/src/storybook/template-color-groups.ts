import type { BrandFoundationV1 } from "@starter/infinite-brand";

type TemplateColorGroup = {
	colors: BrandFoundationV1["colors"] | null;
	label: string;
};

export const templateColorGroups = {
	clay: {
		colors: {
			background: "#f8f1e8",
			neutral: "#3f2921",
			primary: "#b85c38",
			secondary: "#6f8f72",
			tertiary: "#dfc7b7",
		},
		label: "Clay",
	},
	custom: {
		colors: null,
		label: "Template / custom",
	},
	forest: {
		colors: {
			background: "#f7f7ee",
			neutral: "#163020",
			primary: "#2f6b45",
			secondary: "#c47f2a",
			tertiary: "#dce8d5",
		},
		label: "Forest",
	},
	lavender: {
		colors: {
			background: "#faf7ff",
			neutral: "#2e1065",
			primary: "#7c3aed",
			secondary: "#db5bbf",
			tertiary: "#ede9fe",
		},
		label: "Lavender",
	},
	midnight: {
		colors: {
			background: "#071426",
			neutral: "#f8fafc",
			primary: "#3b82f6",
			secondary: "#22d3ee",
			tertiary: "#1e293b",
		},
		label: "Midnight",
	},
	monochrome: {
		colors: {
			background: "#ffffff",
			neutral: "#18181b",
			primary: "#18181b",
			secondary: "#71717a",
			tertiary: "#f4f4f5",
		},
		label: "Monochrome",
	},
	neon: {
		colors: {
			background: "#050505",
			neutral: "#f5f5f5",
			primary: "#27e0a3",
			secondary: "#6d28d9",
			tertiary: "#27272a",
		},
		label: "Neon",
	},
	ocean: {
		colors: {
			background: "#f4f8ff",
			neutral: "#082f49",
			primary: "#0369a1",
			secondary: "#06b6d4",
			tertiary: "#dbeafe",
		},
		label: "Ocean",
	},
	sunset: {
		colors: {
			background: "#fff7ed",
			neutral: "#431407",
			primary: "#ea5455",
			secondary: "#f07b3f",
			tertiary: "#ffd460",
		},
		label: "Sunset",
	},
} as const satisfies Record<string, TemplateColorGroup>;

export type TemplateColorGroupId = keyof typeof templateColorGroups;
