import {
	brandFontPairings,
	brandFoundationSchema,
	type BrandButtonStyle,
	type BrandCornerStyle,
	type BrandFontPairingId,
	type BrandFoundationV1,
	type BrandLogo,
} from "@starter/infinite-brand";

const blob = "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com";

type TemplateBrandSpec = {
	buttons?: BrandButtonStyle;
	colors: BrandFoundationV1["colors"];
	corners: BrandCornerStyle;
	logo?: BrandLogo;
	pairing: BrandFontPairingId;
};

const templateBrandSpecs = {
	"airy-spacious": {
		colors: {
			background: "#000000",
			neutral: "#8d8d8d",
			primary: "#ffffff",
			secondary: "#000000",
			tertiary: "#7f7f7f",
		},
		corners: "soft",
		pairing: "vollkorn-jost",
	},
	"alpina-ventures": {
		colors: {
			background: "#fffcfc",
			neutral: "#8b8d98",
			primary: "#701919",
			secondary: "#701919",
			tertiary: "#701919",
		},
		corners: "square",
		logo: {
			scale: 1,
			src: `${blob}/production/websites/uploaded-media/Alpina-Ventures-Logo-qVRoewYFBnVAAI337wccs4X9lxkMAl.png`,
		},
		pairing: "dm-sans-extralight",
	},
	"artisan-craft": {
		colors: {
			background: "#fdf9f6",
			neutral: "#8d8d86",
			primary: "#9b562b",
			secondary: "#ad7f58",
			tertiary: "#7f5f44",
		},
		corners: "subtle",
		pairing: "bricolage-grotesque",
	},
	"artistic-expression": {
		colors: {
			background: "#f3f0ea",
			neutral: "#8d8d86",
			primary: "#1b5e5e",
			secondary: "#1b5e5e",
			tertiary: "#1b5e5e",
		},
		corners: "square",
		pairing: "fraunces-open-sans-thin",
	},
	"clay-cool": {
		colors: {
			background: "#1d2231",
			neutral: "#8b8d98",
			primary: "#fdf8fc",
			secondary: "#9c7398",
			tertiary: "#212736",
		},
		corners: "rounded",
		logo: { scale: 0.8, src: `${blob}/production/websites/preview-media/generated-image-2026-05-26_15-55-13.png` },
		pairing: "josefin-sans-karla",
	},
	"growth-engine": {
		colors: {
			background: "#ffffff",
			neutral: "#8b8d98",
			primary: "#111111",
			secondary: "#000000",
			tertiary: "#000000",
		},
		corners: "square",
		pairing: "instrument-serif-inter",
	},
	"heritage-drive": {
		colors: {
			background: "#0e1912",
			neutral: "#8d8d8d",
			primary: "#004225",
			secondary: "#004225",
			tertiary: "#004225",
		},
		corners: "rounded",
		logo: {
			scale: 1,
			src: `${blob}/production/websites/generated-logos/add98de0-3314-4426-bec9-b1818f6f25f2-XnsGlpJzdgD8Nn9KyNGexeCQ0ZWkaY.png`,
		},
		pairing: "platypi-maven-pro",
	},
	"honest-craft": {
		colors: {
			background: "#fff8ed",
			neutral: "#8d8d86",
			primary: "#000000",
			secondary: "#f9ab36",
			tertiary: "#f9ab36",
		},
		corners: "square",
		logo: { scale: 1, src: `${blob}/production/infinite-design/example-logos/logo-oak-gran.png` },
		pairing: "roboto-serif-dm-sans",
	},
	"midnight-aurora": {
		colors: {
			background: "#10181c",
			neutral: "#8d8d8d",
			primary: "#161e22",
			secondary: "#eecf29",
			tertiary: "#f97316",
		},
		corners: "soft",
		pairing: "red-hat-display-source-serif-4",
	},
	"modern-foundation": {
		colors: {
			background: "#f4efea",
			neutral: "#8d8d8d",
			primary: "#d4a574",
			secondary: "#d4a574",
			tertiary: "#d4a574",
		},
		corners: "rounded",
		logo: { scale: 1, src: `${blob}/production/infinite-design/example-logos/logo-modern-foundation-inverted.png` },
		pairing: "outfit",
	},
	"nordic-edge": {
		colors: {
			background: "#fbf9f7",
			neutral: "#8b8d98",
			primary: "#d16702",
			secondary: "#938982",
			tertiary: "#d16702",
		},
		corners: "soft",
		logo: {
			scale: 1.8,
			src: `${blob}/production/websites/uploaded-media/ChatGPT%20Image%20May%202%2C%202026%2C%2001_24_37%20PM%201-TQ4PJltwILciaUgNoeoorWsApNXd95.png`,
		},
		pairing: "instrument-serif-inter",
	},
	"paw-voyage": {
		colors: {
			background: "#fccb00",
			neutral: "#8d8d8d",
			primary: "#ffec94",
			secondary: "#ff9200",
			tertiary: "#ff9200",
		},
		corners: "soft",
		logo: {
			scale: 1,
			src: `${blob}/production/websites/generated-logos/154b93c4-3c74-49ef-9f97-114b4ac1c2b7-xVrxkWlawOE2dulRa8aThgpBkmfiFk.png`,
		},
		pairing: "fredoka-quicksand",
	},
	"professional-structure": {
		colors: {
			background: "#38432d",
			neutral: "#8d8d86",
			primary: "#e78745",
			secondary: "#e78745",
			tertiary: "#e78745",
		},
		corners: "square",
		pairing: "libre-baskerville",
	},
	"pure-vitality": {
		colors: {
			background: "#fcfcfd",
			neutral: "#8b8d98",
			primary: "#ece800",
			secondary: "#ece800",
			tertiary: "#1c2024",
		},
		corners: "soft",
		pairing: "instrument-serif-inter",
	},
	"reliable-core": {
		colors: {
			background: "#0f172a",
			neutral: "#8b8d98",
			primary: "#4f46e5",
			secondary: "#0f172a",
			tertiary: "#fafcff",
		},
		corners: "rounded",
		pairing: "space-grotesk-inter",
	},
	"serene-wellness": {
		colors: {
			background: "#f2eff2",
			neutral: "#868e8b",
			primary: "#7f4ee7",
			secondary: "#8b5cf6",
			tertiary: "#8b5cf6",
		},
		corners: "soft",
		pairing: "outfit",
	},
	"sharp-signal": {
		colors: {
			background: "#fcfcfc",
			neutral: "#8d8d8d",
			primary: "#ed2727",
			secondary: "#ed2727",
			tertiary: "#ed2727",
		},
		corners: "rounded",
		logo: { scale: 1, src: `${blob}/production/websites/preview-media/matteo-white-logo.png` },
		pairing: "literata-noto-sans",
	},
	"sparkle-home": {
		colors: {
			background: "#fdfdfb",
			neutral: "#8d8d8d",
			primary: "#242f3d",
			secondary: "#1b2838",
			tertiary: "#242f3d",
		},
		corners: "square",
		pairing: "dm-sans-extralight",
	},
	"steady-ascent": {
		colors: {
			background: "#edf0f1",
			neutral: "#8b8d98",
			primary: "#d4a017",
			secondary: "#d4a017",
			tertiary: "#d4a017",
		},
		corners: "square",
		pairing: "google-sans-flex",
	},
	"strategic-insight": {
		colors: {
			background: "#f6f3ea",
			neutral: "#8b8d98",
			primary: "#000000",
			secondary: "#405f40",
			tertiary: "#000000",
		},
		corners: "soft",
		pairing: "ibm-plex-serif-inter",
	},
	"true-exposure": {
		colors: {
			background: "#fcfcfc",
			neutral: "#8d8d8d",
			primary: "#4f46e5",
			secondary: "#4f46e5",
			tertiary: "#4f46e5",
		},
		corners: "square",
		pairing: "figtree",
	},
	"urban-edge": {
		colors: {
			background: "#1d2231",
			neutral: "#8b8d98",
			primary: "#f3fcf3",
			secondary: "#00ff48",
			tertiary: "#ff6b00",
		},
		corners: "rounded",
		pairing: "oswald-inter",
	},
	"vibrant-blooms": {
		colors: {
			background: "#f7efe3",
			neutral: "#8d8d86",
			primary: "#c2703e",
			secondary: "#c2703e",
			tertiary: "#c2703e",
		},
		corners: "subtle",
		logo: { scale: 1, src: `${blob}/development/website-builder-v2/florora-logo.svg` },
		pairing: "libre-bodoni-chivo",
	},
} satisfies Record<string, TemplateBrandSpec>;

const getTemplateBrandSpec = ({ templateId }: { templateId: string }) => {
	const spec = Object.entries(templateBrandSpecs).find(([registeredId]) => registeredId === templateId)?.[1];

	if (!spec) {
		throw new Error(`No brand is registered for template "${templateId}"`);
	}

	return spec;
};

export const getTemplateBrand = ({ logo = true, templateId }: { logo?: boolean; templateId: string }) => {
	const spec = getTemplateBrandSpec({ templateId });

	return brandFoundationSchema.parse({
		buttons: { style: "buttons" in spec ? spec.buttons : "solid" },
		colors: spec.colors,
		corners: { style: spec.corners },
		defaultLocale: "en",
		...(logo && "logo" in spec && { logo: spec.logo }),
		locales: ["en", "ar"],
		schemaVersion: 1,
		typography: { catalogVersion: 1, ...brandFontPairings[spec.pairing] },
	});
};

export const getTemplateStoryBrandArgs = ({ templateId }: { templateId: string }) => {
	const spec = getTemplateBrandSpec({ templateId });
	const brand = getTemplateBrand({ templateId });

	return {
		backgroundColor: brand.colors.background,
		bodyWeight: brand.typography.body.default.weight,
		brand,
		colorGroup: "custom" as const,
		cornerStyle: brand.corners.style,
		fontPairing: spec.pairing,
		headingWeight: brand.typography.heading.default.weight,
		locale: "en" as const,
		neutralColor: brand.colors.neutral,
		primaryColor: brand.colors.primary,
		secondaryColor: brand.colors.secondary,
		tertiaryColor: brand.colors.tertiary,
	};
};
