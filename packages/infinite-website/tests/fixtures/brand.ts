import { brandFontPairings, brandFoundationSchema } from "@starter/infinite-brand";

export const testBrand = brandFoundationSchema.parse({
	colors: {
		background: "#fffaf2",
		neutral: "#18201d",
		primary: "#18332d",
		secondary: "#c77737",
		tertiary: "#e9e5dc",
	},
	corners: { style: "rounded" },
	defaultLocale: "en",
	locales: ["en", "ar"],
	schemaVersion: 1,
	typography: { catalogVersion: 1, ...brandFontPairings.editorial },
});
