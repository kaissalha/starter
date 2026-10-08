import type { BrandFoundationV1 } from "../../src/brand-foundation";

export const brandFoundationFixture = {
	colors: {
		background: "#FFFFFF",
		neutral: "#2D4059",
		primary: "#EA5455",
		secondary: "#F07B3F",
		tertiary: "#FFD460",
	},
	corners: { style: "rounded" },
	defaultLocale: "en",
	locales: ["en", "ar"],
	schemaVersion: 1,
	typography: {
		body: {
			default: { fontId: "inter", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		catalogVersion: 1,
		heading: {
			default: { fontId: "outfit", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
} satisfies BrandFoundationV1;
