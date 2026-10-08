import {
	defaultLinkPageSectionAppearance,
	localizeForLocales,
	type LinkPageBlock,
	type LinkPageBlockKind,
	type LinkPageLink,
	type LinkPageSocial,
	type LinkPageSocialPlatform,
} from "@starter/infinite-links";

type Locales = ReadonlyArray<string>;

const isArabic = (locale: string) => new Intl.Locale(locale).language === "ar";

const placeholderUrl = "https://example.com";

const localized = ({ ar, en, locales }: { ar: string; en: string; locales: Locales }) =>
	localizeForLocales({ locales, resolve: (locale) => (isArabic(locale) ? ar : en) });

export const createLinkPageLink = ({ locales }: { locales: Locales }): LinkPageLink => ({
	appearance: defaultLinkPageSectionAppearance,
	enabled: true,
	id: crypto.randomUUID(),
	kind: "link",
	label: localized({ ar: "رابط جديد", en: "New link", locales }),
	layout: "classic",
	url: placeholderUrl,
});

export const createLinkPageBlock = ({
	kind,
	locales,
}: {
	kind: LinkPageBlockKind;
	locales: Locales;
}): LinkPageBlock => {
	const id = crypto.randomUUID();

	switch (kind) {
		case "collection":
			return {
				appearance: defaultLinkPageSectionAppearance,
				display: "stack",
				enabled: true,
				id,
				kind,
				links: [createLinkPageLink({ locales })],
				title: localized({ ar: "مجموعة", en: "Collection", locales }),
			};
		case "header":
			return {
				appearance: defaultLinkPageSectionAppearance,
				enabled: true,
				id,
				kind,
				text: localized({ ar: "عنوان", en: "Headline", locales }),
			};
		case "link":
			return createLinkPageLink({ locales });
		case "socials":
			return { appearance: defaultLinkPageSectionAppearance, enabled: true, id, items: [], kind };
		case "text":
			return {
				appearance: defaultLinkPageSectionAppearance,
				button: null,
				enabled: true,
				id,
				kind,
				text: localized({ ar: "أضف نصك هنا.", en: "Add your text here.", locales }),
			};
		case "video":
			return {
				appearance: defaultLinkPageSectionAppearance,
				enabled: true,
				id,
				kind,
				title: {},
				url: "https://www.youtube.com/watch?v=",
			};
		case "announcement":
			return {
				...base(id),
				button: null,
				colors: null,
				description: {},
				kind,
				layout: "banner",
				title: localized({ ar: "إعلان جديد", en: "New announcement", locales }),
			};
		case "countdown":
			return {
				...base(id),
				description: {},
				endedMessage: localized({ ar: "انتهى العد التنازلي", en: "The countdown has ended", locales }),
				endsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
				kind,
				title: localized({ ar: "قريباً", en: "Coming soon", locales }),
			};
		case "embed":
			return { ...base(id), kind, title: {}, url: "https://open.spotify.com/track/" };
		case "faq":
			return {
				...base(id),
				description: {},
				items: [
					{
						answer: localized({ ar: "الإجابة هنا.", en: "The answer goes here.", locales }),
						id: crypto.randomUUID(),
						question: localized({ ar: "سؤال شائع", en: "A common question", locales }),
					},
				],
				kind,
				title: localized({ ar: "الأسئلة الشائعة", en: "Frequently asked questions", locales }),
			};
		case "form":
			return {
				...base(id),
				action: placeholderUrl,
				description: {},
				fields: [
					{
						id: crypto.randomUUID(),
						label: localized({ ar: "البريد الإلكتروني", en: "Email", locales }),
						required: true,
						type: "email",
					},
				],
				kind,
				submitLabel: {},
				title: localized({ ar: "اشترك في النشرة", en: "Join the newsletter", locales }),
			};
		case "marquee":
			return {
				...base(id),
				colors: null,
				kind,
				separator: "✦",
				speed: 0.4,
				style: "plain",
				text: localized({ ar: "نص متحرك", en: "Scrolling text", locales }),
				uppercase: false,
			};
		case "tabs":
			return {
				...base(id),
				items: [
					{ id: crypto.randomUUID(), label: localized({ ar: "الرئيسية", en: "Home", locales }), url: "/" },
				],
				kind,
			};
		case "testimonials":
			return {
				...base(id),
				description: {},
				items: [
					{
						company: {},
						id: crypto.randomUUID(),
						imageUrl: null,
						name: localized({ ar: "عميل سعيد", en: "A happy customer", locales }),
						quote: localized({
							ar: "تجربة رائعة من البداية للنهاية.",
							en: "A wonderful experience from start to finish.",
							locales,
						}),
						url: null,
					},
				],
				kind,
				title: localized({ ar: "التقييمات", en: "Reviews", locales }),
			};
	}
};

const base = (id: string) => ({ appearance: defaultLinkPageSectionAppearance, enabled: true, id });

const mapsSearch = (query: string) =>
	`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || "business")}`;

export const linkPagePresets = ["whatsapp", "directions", "reviews", "booking", "menu"] as const;

export type LinkPagePreset = (typeof linkPagePresets)[number];

const presetContent = {
	booking: { ar: "احجز موعدًا", en: "Book an appointment", url: () => placeholderUrl },
	directions: { ar: "احصل على الاتجاهات", en: "Get directions", url: mapsSearch },
	menu: { ar: "تصفح القائمة", en: "See our menu", url: () => placeholderUrl },
	reviews: { ar: "اترك لنا تقييمًا", en: "Leave us a review", url: mapsSearch },
	whatsapp: { ar: "راسلنا على واتساب", en: "Message us on WhatsApp", url: () => "https://wa.me/" },
} satisfies Record<LinkPagePreset, { ar: string; en: string; url: (query: string) => string }>;

export const createLinkPagePresetLink = ({
	businessName,
	locales,
	preset,
}: {
	businessName: string;
	locales: Locales;
	preset: LinkPagePreset;
}): LinkPageLink => {
	const content = presetContent[preset];

	return {
		...createLinkPageLink({ locales }),
		label: localized({ ar: content.ar, en: content.en, locales }),
		url: content.url(businessName),
	};
};

export const createLinkPageUrlLink = ({
	label,
	locales,
	url,
}: {
	label: string;
	locales: Locales;
	url: string;
}): LinkPageLink => ({
	...createLinkPageLink({ locales }),
	label: localizeForLocales({ locales, resolve: () => label }),
	url,
});

export const createLinkPageTextButton = ({ locales }: { locales: Locales }) => ({
	label: localized({ ar: "اعرف المزيد", en: "Learn more", locales }),
	url: placeholderUrl,
});

export const createLinkPageSocial = (platform: LinkPageSocialPlatform): LinkPageSocial => ({
	id: crypto.randomUUID(),
	platform,
	url: platform === "email" ? "mailto:" : "https://",
});
