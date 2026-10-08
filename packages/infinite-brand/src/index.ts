export { brandFoundationSchema, type BrandFoundationV1 } from "./brand-foundation";

export { brandLogoScale, brandLogoSchema, type BrandLogo } from "./logo";

export { applyBrandUpdate, brandUpdateSchema, type BrandUpdate } from "./brand-update";

export {
	brandButtonStyles,
	brandCornerStyles,
	brandCornerStyleSchema,
	type BrandButtonStyle,
	type BrandCornerStyle,
} from "./corners";

export { resolveBrandFontSelection, type BrandFontRole } from "./typography";

export { brandFontCatalog, getBrandFont, type BrandFontCatalogEntry } from "./fonts/catalog";

export {
	brandFontPairingIds,
	brandFontPairingIdSchema,
	brandFontPairings,
	brandFontPairingSchema,
	featuredBrandFontPairingIds,
	type BrandFontPairingId,
	type BrandTypeOverride,
	type BrandTypeScale,
} from "./fonts/pairings";

export {
	areBrandFontRolesEqual,
	brandColorNames,
	findBrandFontPairing,
	findBrandPalettePreset,
	findBrandTypeScale,
} from "./matching";

export { brandOptions, brandOptionsSchema, brandPalettePresets, type BrandOptions } from "./options";

export { canonicalLocaleKeySchema, localeSchema, localesSchema, type BrandLocale } from "./localization";
