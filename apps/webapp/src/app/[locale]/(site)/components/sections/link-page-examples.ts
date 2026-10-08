import type { getTranslations } from "next-intl/server";

import {
	applyLinkPageTheme,
	createDefaultLinkPageDocument,
	defaultLinkPageBrand,
	defaultLinkPageSectionAppearance,
	linkPageThemes,
	resolveLinkPageBrand,
	type LinkPageBlock,
	type LinkPageDocument,
	type LinkPageLink,
} from "@starter/infinite-links";

type LinksTranslator = Awaited<ReturnType<typeof getTranslations<"site.links">>>;

export const linkPageExamples = [
	{
		className: "hidden -rotate-6 lg:block rtl:rotate-6",
		id: "bakery",
		links: [{ animation: "pulse", image: "site-bakery", key: "first" }, { key: "second" }, { key: "third" }],
		owner: "baker",
		socials: ["instagram", "whatsapp", "email"],
		theme: "accra",
	},
	{
		className: "z-10",
		id: "barber",
		links: [{ animation: "jump", key: "first" }, { image: "site-barber", key: "second" }, { key: "third" }],
		owner: "barber",
		socials: ["instagram", "tiktok", "whatsapp"],
		theme: "nuremberg",
	},
	{
		className: "z-10 hidden sm:block",
		id: "florist",
		links: [{ animation: "tada", key: "first" }, { key: "second" }, { key: "third" }],
		owner: "florist",
		socials: ["instagram", "facebook", "whatsapp"],
		theme: "santa-cruz",
	},
	{
		className: "hidden rotate-6 lg:block rtl:-rotate-6",
		id: "ceramics",
		links: [{ image: "site-ceramics", key: "first" }, { animation: "swing", key: "second" }, { key: "third" }],
		owner: "ceramicist",
		socials: ["instagram", "youtube", "email"],
		theme: "izmir",
	},
] as const;

export type LinkPageExampleConfig = (typeof linkPageExamples)[number];

const uuid = (example: LinkPageExampleConfig["id"], index: number) =>
	`018ff7c2-1f7c-7b28-b6c1-3f2e60b5d${linkPageExamples.findIndex((entry) => entry.id === example)}${index.toString(16).padStart(2, "0")}`;

const socialUrls = {
	email: "mailto:hello@example.com",
	facebook: "https://facebook.com",
	instagram: "https://instagram.com",
	tiktok: "https://tiktok.com",
	whatsapp: "https://wa.me",
	youtube: "https://youtube.com",
} as const;

export const buildLinkPageExample = ({
	ar,
	en,
	example,
}: {
	ar: LinksTranslator;
	en: LinksTranslator;
	example: LinkPageExampleConfig;
}) => {
	const text = (key: Parameters<typeof en>[0]) => ({ ar: ar(key), en: en(key) });
	const base = createDefaultLinkPageDocument({ name: en(`items.${example.id}.name`) });
	const theme = linkPageThemes.find((entry) => entry.id === example.theme);
	const socialsId = uuid(example.id, 0);

	const links: Array<LinkPageLink> = example.links.map((link, index) => ({
		animation: "animation" in link ? link.animation : undefined,
		appearance: defaultLinkPageSectionAppearance,
		enabled: true,
		id: uuid(example.id, index + 1),
		imageUrl: "image" in link ? `/images/home/${link.image}.webp` : null,
		kind: "link",
		label: text(`items.${example.id}.links.${link.key}`),
		layout: "classic",
		url: "https://example.com",
	}));

	const socials: LinkPageBlock = {
		appearance: defaultLinkPageSectionAppearance,
		enabled: true,
		id: socialsId,
		items: example.socials.map((platform, index) => ({
			id: uuid(example.id, index + 8),
			platform,
			url: socialUrls[platform],
		})),
		kind: "socials",
	};

	const document: LinkPageDocument = {
		...base,
		blocks: [socials, ...links],
		headerBlockIds: [socialsId],
		profile: {
			...base.profile,
			bio: text(`items.${example.id}.bio`),
			imageUrl: `/images/home/owner-${example.owner}.webp`,
			tagline: text(`items.${example.id}.tagline`),
			title: text(`items.${example.id}.name`),
		},
	};

	const themed = theme ? applyLinkPageTheme({ document, theme }) : document;

	return {
		brand: resolveLinkPageBrand({
			brandOverride: themed.appearance.brandOverride,
			inheritedBrand: defaultLinkPageBrand,
		}),
		document: themed,
	};
};
