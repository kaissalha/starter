import { linkPages, type Transaction } from "@starter/db";
import {
	defaultLinkPageSectionAppearance,
	linkPageDocumentSchema,
	linkPageLimits,
} from "@starter/infinite-links/contracts";
import { createDefaultLinkPageDocument } from "@starter/infinite-links/document";
import type { Iso6391LanguageCode, PersistedWebsiteSiteV1 } from "@starter/infinite-website/contracts";
import { generationSeedHash } from "@starter/infinite-website/generation";

import { websiteNavigationLabel } from "./generation-actions";

const generatedDesigns = {
	layout: ["business", "centered", "classic", "hero", "minimal-01", "minimal-04"],
	shadow: ["none", "subtle", "hard"],
	wallpaper: [{ style: "fill" }, { style: "gradient" }, { pattern: "polka", style: "pattern" }],
} as const;

const createWebsiteLinkPage = ({ organizationId, site }: { organizationId: string; site: PersistedWebsiteSiteV1 }) => {
	const { brand, document } = site;
	const content = document.content[document.defaultLocale];
	const name = content?.site.name;

	if (!content || !name) {
		throw new Error("Generated website is missing its default content");
	}

	const base = createDefaultLinkPageDocument({ brand, name: name.slice(0, linkPageLimits.title) });

	const copy = (resolve: (locale: Iso6391LanguageCode) => string) =>
		Object.fromEntries(document.locales.map((locale) => [locale, resolve(locale)]));

	const draw = <Key extends keyof typeof generatedDesigns>(key: Key): (typeof generatedDesigns)[Key][number] =>
		generatedDesigns[key][generationSeedHash(`${organizationId}:${key}`) % generatedDesigns[key].length]!;

	return linkPageDocumentSchema.parse({
		...base,
		appearance: {
			...base.appearance,
			buttons: {
				...base.appearance.buttons,
				shadow: draw("shadow"),
				style: brand.buttons?.style ?? "solid",
			},
			wallpaper: { ...base.appearance.wallpaper, ...draw("wallpaper") },
		},
		blocks: document.structure.pages.slice(0, linkPageLimits.blocks).map((page) => {
			const pageContent = content.pages[page.id];
			const slug = pageContent?.route?.slug;

			if (!slug) {
				throw new Error("Generated website is missing page content");
			}

			return {
				appearance: defaultLinkPageSectionAppearance,
				enabled: true,
				id: crypto.randomUUID(),
				kind: "link",
				label: copy((locale) => {
					if (page.home) {
						return locale === "ar" ? "الموقع الإلكتروني" : "Website";
					}

					return websiteNavigationLabel({ locale, pageKey: slug });
				}),
				layout: "classic",
				url: page.home ? "/" : `/${slug}`,
			};
		}),
		profile: {
			...base.profile,
			bio: copy((locale) =>
				(document.content[locale]?.site.description ?? content.site.description ?? "").slice(
					0,
					linkPageLimits.bio
				)
			),
			layout: draw("layout"),
			title: copy((locale) => (document.content[locale]?.site.name ?? name).slice(0, linkPageLimits.title)),
		},
	});
};

export const saveInitialWebsiteLinkPage = async ({
	currentVersion,
	organizationId,
	site,
	transaction,
}: {
	currentVersion: { id: string } | null;
	organizationId: string;
	site: PersistedWebsiteSiteV1;
	transaction: Transaction;
}) => {
	if (currentVersion) {
		return;
	}

	await transaction
		.insert(linkPages)
		.values({ document: createWebsiteLinkPage({ organizationId, site }), organizationId })
		.onConflictDoNothing({ target: linkPages.organizationId });
};
