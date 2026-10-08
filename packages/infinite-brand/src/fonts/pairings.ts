import { z } from "zod";

import { brandFontRoleSchema, type BrandFontRole } from "../typography";

export const brandFontPairingIdSchema = z.compile(
	z.enum([
		"albert-sans",
		"anybody-frank-ruhl-libre",
		"archivo-alegreya",
		"bitter-nunito-sans",
		"bricolage-grotesque",
		"crimson-pro",
		"default",
		"dm-sans-extralight",
		"editorial",
		"elegant-serif",
		"familjen-grotesk-be-vietnam-pro",
		"figtree",
		"fraunces-open-sans",
		"fraunces-open-sans-thin",
		"fredoka-quicksand",
		"funnel-display-onest",
		"gabarito-atkinson-hyperlegible-next",
		"google-sans-flex",
		"ibm-plex-serif-inter",
		"instrument-serif-inter",
		"josefin-sans-karla",
		"lexend",
		"libre-baskerville",
		"libre-bodoni-chivo",
		"literata-noto-sans",
		"manrope-lora",
		"minimal",
		"modern",
		"modern-durable",
		"montagu-slab",
		"newsreader-plus-jakarta-sans",
		"nunito",
		"oswald-inter",
		"oswald-source",
		"outfit",
		"petrona-hanken-grotesk",
		"platypi-maven-pro",
		"playfair-source",
		"playpen-sans-grandstander",
		"plus-jakarta-sans-inter",
		"raleway-lato",
		"red-hat-display-source-serif-4",
		"rethink-sans-commissioner",
		"roboto-serif-dm-sans",
		"schibsted-grotesk-noto-serif",
		"signika-asap",
		"sofia-sans-condensed",
		"sora-barlow",
		"space-grotesk",
		"space-grotesk-inter",
		"syne-geist",
		"unbounded-geist",
		"vollkorn-jost",
		"work-sans-rubik",
	])
);

export const brandFontPairingSchema = z.compile(
	z.strictObject({
		body: brandFontRoleSchema,
		heading: brandFontRoleSchema,
	})
);

export type BrandFontPairing = {
	body: BrandFontRole;
	heading: BrandFontRole;
};

export type BrandTypeOverride = {
	brandFont?: true;
	lineHeight?: number;
	tracking?: string;
	weight?: number;
};

export type BrandTypeScale = Readonly<Record<string, BrandTypeOverride>>;

const bodyRole = (fontId: string): BrandFontRole => ({
	default: { fontId, weight: 400 },
	scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
});

const headingRole = ({ arab, fontId }: { arab: string; fontId: string }): BrandFontRole => ({
	default: { fontId, weight: 600 },
	scripts: { Arab: { fontId: arab, weight: 600 } },
});

export const brandFontPairings = {
	"albert-sans": {
		body: {
			default: { fontId: "inter", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "albert-sans", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"anybody-frank-ruhl-libre": {
		body: {
			default: { fontId: "frank-ruhl-libre", weight: 400 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "anybody", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"archivo-alegreya": {
		body: {
			default: { fontId: "alegreya", weight: 400 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "archivo", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"bitter-nunito-sans": {
		body: {
			default: { fontId: "nunito-sans", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "bitter", weight: 600 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 600 } },
		},
	},
	"bricolage-grotesque": {
		body: {
			default: { fontId: "inter", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "bricolage-grotesque", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"crimson-pro": {
		body: {
			default: { fontId: "public-sans", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "crimson-pro", weight: 600 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 600 } },
		},
	},
	default: {
		body: bodyRole("inter"),
		heading: headingRole({ arab: "noto-naskh-arabic", fontId: "playfair-display" }),
	},
	"dm-sans-extralight": {
		body: {
			default: { fontId: "dm-sans", weight: 200 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "dm-sans", weight: 200 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 400 } },
		},
	},
	editorial: {
		body: {
			default: { fontId: "source-serif-4", weight: 400 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "playfair-display", weight: 500 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 500 } },
		},
	},
	"elegant-serif": {
		body: bodyRole("mulish"),
		heading: headingRole({ arab: "noto-naskh-arabic", fontId: "playfair-display" }),
	},
	"familjen-grotesk-be-vietnam-pro": {
		body: {
			default: { fontId: "be-vietnam-pro", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "familjen-grotesk", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	figtree: {
		body: { default: { fontId: "figtree", weight: 400 }, scripts: { Arab: { fontId: "cairo", weight: 400 } } },
		heading: {
			default: { fontId: "figtree", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"fraunces-open-sans": {
		body: {
			default: { fontId: "open-sans", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "fraunces", weight: 600 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 600 } },
		},
	},
	"fraunces-open-sans-thin": {
		body: {
			default: { fontId: "open-sans", weight: 300 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "fraunces", weight: 100 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 400 } },
		},
	},
	"fredoka-quicksand": {
		body: {
			default: { fontId: "quicksand", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "fredoka", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"funnel-display-onest": {
		body: {
			default: { fontId: "onest", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "funnel-display", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"gabarito-atkinson-hyperlegible-next": {
		body: {
			default: { fontId: "atkinson-hyperlegible-next", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "gabarito", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"google-sans-flex": {
		body: {
			default: { fontId: "google-sans-flex", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "google-sans-flex", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"ibm-plex-serif-inter": {
		body: {
			default: { fontId: "inter", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "ibm-plex-serif", weight: 600 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 600 } },
		},
	},
	"instrument-serif-inter": {
		body: {
			default: { fontId: "inter", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "instrument-serif", weight: 400 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 400 } },
		},
	},
	"josefin-sans-karla": {
		body: { default: { fontId: "karla", weight: 400 }, scripts: { Arab: { fontId: "cairo", weight: 400 } } },
		heading: {
			default: { fontId: "josefin-sans", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	lexend: {
		body: {
			default: { fontId: "lexend", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "lexend", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"libre-baskerville": {
		body: {
			default: { fontId: "source-sans-3", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "libre-baskerville", weight: 600 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 600 } },
		},
	},
	"libre-bodoni-chivo": {
		body: {
			default: { fontId: "chivo", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "libre-bodoni", weight: 600 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 600 } },
		},
	},
	"literata-noto-sans": {
		body: {
			default: { fontId: "noto-sans", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "literata", weight: 600 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 600 } },
		},
	},
	"manrope-lora": {
		body: {
			default: { fontId: "lora", weight: 400 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "manrope", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	minimal: {
		body: {
			default: { fontId: "inter", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "inter", weight: 600 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 600 } },
		},
	},
	modern: {
		body: { default: { fontId: "manrope", weight: 400 }, scripts: { Arab: { fontId: "cairo", weight: 400 } } },
		heading: {
			default: { fontId: "outfit", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"modern-durable": {
		body: { default: { fontId: "open-sans", weight: 400 }, scripts: { Arab: { fontId: "cairo", weight: 400 } } },
		heading: {
			default: { fontId: "montserrat", weight: 700 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 700 } },
		},
	},
	"montagu-slab": {
		body: {
			default: { fontId: "open-sans", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "montagu-slab", weight: 600 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 600 } },
		},
	},
	"newsreader-plus-jakarta-sans": {
		body: {
			default: { fontId: "plus-jakarta-sans", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "newsreader", weight: 600 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 600 } },
		},
	},
	nunito: {
		body: {
			default: { fontId: "nunito", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "nunito", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"oswald-inter": {
		body: bodyRole("inter"),
		heading: headingRole({ arab: "noto-kufi-arabic", fontId: "oswald" }),
	},
	"oswald-source": {
		body: bodyRole("source-sans-3"),
		heading: headingRole({ arab: "noto-kufi-arabic", fontId: "oswald" }),
	},
	outfit: {
		body: { default: { fontId: "outfit", weight: 400 }, scripts: { Arab: { fontId: "cairo", weight: 400 } } },
		heading: {
			default: { fontId: "outfit", weight: 300 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 400 } },
		},
	},
	"petrona-hanken-grotesk": {
		body: {
			default: { fontId: "hanken-grotesk", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "petrona", weight: 600 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 600 } },
		},
	},
	"platypi-maven-pro": {
		body: {
			default: { fontId: "maven-pro", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "platypi", weight: 600 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 600 } },
		},
	},
	"playfair-source": {
		body: bodyRole("source-sans-3"),
		heading: headingRole({ arab: "noto-naskh-arabic", fontId: "playfair-display" }),
	},
	"playpen-sans-grandstander": {
		body: {
			default: { fontId: "grandstander", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "playpen-sans", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"plus-jakarta-sans-inter": {
		body: {
			default: { fontId: "inter", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "plus-jakarta-sans", weight: 500 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 500 } },
		},
	},
	"raleway-lato": {
		body: {
			default: { fontId: "lato", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "raleway", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"red-hat-display-source-serif-4": {
		body: {
			default: { fontId: "source-serif-4", weight: 400 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "red-hat-display", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"rethink-sans-commissioner": {
		body: {
			default: { fontId: "commissioner", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "rethink-sans", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"roboto-serif-dm-sans": {
		body: {
			default: { fontId: "dm-sans", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "roboto-serif", weight: 300 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 400 } },
		},
	},
	"schibsted-grotesk-noto-serif": {
		body: {
			default: { fontId: "noto-serif", weight: 400 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "schibsted-grotesk", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"signika-asap": {
		body: {
			default: { fontId: "asap", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "signika", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"sofia-sans-condensed": {
		body: {
			default: { fontId: "sofia-sans", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "sofia-sans-condensed", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"sora-barlow": {
		body: {
			default: { fontId: "barlow", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "sora", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"space-grotesk": {
		body: bodyRole("space-grotesk"),
		heading: headingRole({ arab: "noto-kufi-arabic", fontId: "space-grotesk" }),
	},
	"space-grotesk-inter": {
		body: bodyRole("inter"),
		heading: headingRole({ arab: "noto-kufi-arabic", fontId: "space-grotesk" }),
	},
	"syne-geist": {
		body: { default: { fontId: "geist", weight: 400 }, scripts: { Arab: { fontId: "cairo", weight: 400 } } },
		heading: {
			default: { fontId: "syne", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"unbounded-geist": {
		body: {
			default: { fontId: "geist", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "unbounded", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
	"vollkorn-jost": {
		body: {
			default: { fontId: "jost", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "vollkorn", weight: 600 },
			scripts: { Arab: { fontId: "noto-naskh-arabic", weight: 600 } },
		},
	},
	"work-sans-rubik": {
		body: {
			default: { fontId: "rubik", weight: 400 },
			scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
		},
		heading: {
			default: { fontId: "work-sans", weight: 600 },
			scripts: { Arab: { fontId: "noto-kufi-arabic", weight: 600 } },
		},
	},
} as const satisfies Record<BrandFontPairingId, BrandFontPairing>;

export const brandFontPairingIds = brandFontPairingIdSchema.options;

export const featuredBrandFontPairingIds = [
	"minimal",
	"modern",
	"editorial",
	"instrument-serif-inter",
	"modern-durable",
	"syne-geist",
] as const satisfies ReadonlyArray<z.infer<typeof brandFontPairingIdSchema>>;

export type BrandFontPairingId = z.infer<typeof brandFontPairingIdSchema>;
