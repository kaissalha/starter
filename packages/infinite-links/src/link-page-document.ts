import {
	brandFontPairings,
	brandFoundationSchema,
	brandUpdateSchema,
	type BrandFoundationV1,
	type BrandUpdate,
} from "@starter/infinite-brand";

import {
	defaultLinkPageAppearance,
	defaultLinkPageBrand,
	httpUrlSchema,
	linkPageDocumentSchema,
	type LinkPageCollectionBlock,
	type LinkPageDocument,
	type LinkPageLink,
	type LinkPageLocale,
	type LocalizedLinkPageText,
} from "./contracts";

const resolveImageUrl = (imageUrl?: string | null) => {
	const parsed = httpUrlSchema.safeParse(imageUrl);

	return parsed.success ? parsed.data : null;
};

const isArabic = (locale: string) => locale.toLowerCase().startsWith("ar");

export const localizeForLocales = ({
	locales,
	resolve,
}: {
	locales: ReadonlyArray<string>;
	resolve: (locale: string) => string;
}): LocalizedLinkPageText => Object.fromEntries(locales.map((locale) => [locale, resolve(locale)]));

export const createDefaultLinkPageDocument = ({
	brand = defaultLinkPageBrand,
	imageUrl,
	name,
}: {
	brand?: BrandFoundationV1;
	imageUrl?: string | null;
	name: string;
}): LinkPageDocument => {
	const title = name.trim() || "Your links";

	return linkPageDocumentSchema.parse({
		appearance: defaultLinkPageAppearance,
		blocks: [],
		headerBlockIds: [],
		profile: {
			alignment: "center",
			bio: localizeForLocales({
				locales: brand.locales,
				resolve: (locale) =>
					isArabic(locale) ? "كل ما تحتاجه، في مكان واحد." : "Everything you need, in one place.",
			}),
			imageUrl: resolveImageUrl(imageUrl),
			layout: "classic",
			title: localizeForLocales({ locales: brand.locales, resolve: () => title }),
			titleSize: "small",
		},
		redirectBlockId: null,
		schemaVersion: 1,
	} satisfies LinkPageDocument);
};

export const resolveLinkPageBrand = ({
	brandOverride,
	inheritedBrand,
}: {
	brandOverride: BrandUpdate | null;
	inheritedBrand: BrandFoundationV1;
}) => {
	if (!brandOverride) {
		return brandFoundationSchema.parse(inheritedBrand);
	}

	const override = brandUpdateSchema.parse(brandOverride);

	return brandFoundationSchema.parse({
		...inheritedBrand,
		colors: override.colors ? { ...inheritedBrand.colors, ...override.colors } : inheritedBrand.colors,
		corners: override.cornerStyle ? { style: override.cornerStyle } : inheritedBrand.corners,
		typography: override.fontPairingId
			? { catalogVersion: 1, ...brandFontPairings[override.fontPairingId] }
			: inheritedBrand.typography,
	});
};

export const resolveLinkPageLocale = ({ brand, locale }: { brand: BrandFoundationV1; locale?: LinkPageLocale }) => {
	if (!locale) {
		return brand.defaultLocale;
	}

	return brand.locales.find((candidate) => candidate === locale) ?? null;
};

type LinkPageLinkEntry = { collection: LinkPageCollectionBlock | null; link: LinkPageLink };

const listLinkPageLinks = ({ document }: { document: LinkPageDocument }) =>
	document.blocks.flatMap((block): Array<LinkPageLinkEntry> => {
		if (block.kind === "link") {
			return [{ collection: null, link: block }];
		}

		if (block.kind === "collection") {
			return block.links.map((link) => ({ collection: block, link }));
		}

		return [];
	});

export const resolveLinkPageRedirect = ({ document }: { document: LinkPageDocument }) => {
	if (!document.redirectBlockId) {
		return null;
	}

	const match = listLinkPageLinks({ document }).find(({ link }) => link.id === document.redirectBlockId);

	if (!match || !match.link.enabled || (match.collection && !match.collection.enabled)) {
		return null;
	}

	return match.link.url;
};
