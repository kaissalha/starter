import type { Meta, StoryObj } from "@storybook/react-vite";
import { z } from "zod";

import {
	defaultLinkPageBrand,
	defaultLinkPageSectionAppearance,
	linkPageBlockSchema,
	linkPageProfileSchema,
	type LinkPageDocument,
	type LinkPageLink,
	type LinkPageLocale,
} from "./contracts";
import customerPages from "./customer-pages.json";
import { createDefaultLinkPageDocument, resolveLinkPageBrand } from "./link-page-document";
import { LinkPageRenderer } from "./link-page-renderer";
import { applyLinkPageTheme, linkPageThemeCategories, linkPageThemes, type LinkPageTheme } from "./themes";

const image = (id: string) => `https://images.unsplash.com/photo-${id}?w=600&h=600&fit=crop`;

const link = ({
	id,
	imageId,
	label,
}: {
	id: string;
	imageId?: string;
	label: LinkPageLink["label"];
}): LinkPageLink => ({
	appearance: defaultLinkPageSectionAppearance,
	enabled: true,
	id,
	imageUrl: imageId ? image(imageId) : null,
	kind: "link",
	label,
	layout: "classic",
	url: "https://example.com",
});

const socialsId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d400";

const baseDocument = createDefaultLinkPageDocument({
	imageUrl: image("1494790108377-be9c29b29330"),
	name: "Maya Laurent",
});

const storyDocument: LinkPageDocument = {
	...baseDocument,
	blocks: [
		{
			appearance: defaultLinkPageSectionAppearance,
			enabled: true,
			id: socialsId,
			items: [
				{ id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d401", platform: "instagram", url: "https://instagram.com" },
				{ id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d402", platform: "tiktok", url: "https://tiktok.com" },
				{ id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d403", platform: "youtube", url: "https://youtube.com" },
				{ id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d404", platform: "email", url: "mailto:hello@example.com" },
			],
			kind: "socials",
		},
		link({
			id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d405",
			imageId: "1555507036-ab1f4038808a",
			label: { ar: "اطلب من المخبز", en: "Order from the bakery" },
		}),
		link({
			id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d406",
			imageId: "1534438327276-14e5300c3a48",
			label: { ar: "احجز جلسة تدريب", en: "Book a training session" },
		}),
		{
			appearance: defaultLinkPageSectionAppearance,
			enabled: true,
			id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d407",
			kind: "header",
			text: { ar: "الأحدث", en: "Latest" },
		},
		link({
			id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d408",
			imageId: "1490750967868-88aa4486c946",
			label: { ar: "مجموعة الربيع", en: "Spring collection" },
		}),
		link({
			id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d409",
			imageId: "1416879595882-3373a0480b5b",
			label: { ar: "دليل الحديقة المجاني", en: "Free garden guide" },
		}),
		link({
			id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d40a",
			label: { ar: "اشترك في النشرة", en: "Join the newsletter" },
		}),
	],
	headerBlockIds: [socialsId],
	profile: {
		...baseDocument.profile,
		tagline: { ar: "خبازة ومدربة", en: "Baker & coach" },
	},
};

const customerPageSchema = z.strictObject({
	blocks: z.array(linkPageBlockSchema),
	headerBlockIds: z.array(z.uuid()),
	profile: linkPageProfileSchema.pick({
		actions: true,
		bio: true,
		imageUrl: true,
		tagline: true,
		title: true,
		verified: true,
	}),
});

const customerDocuments = new Map(
	Object.entries(customerPages).map(([id, page]) => {
		const parsed = customerPageSchema.parse(page);

		return [id, { ...baseDocument, ...parsed, profile: { ...baseDocument.profile, ...parsed.profile } }];
	})
);

const ThemedPage = ({ locale, theme }: { locale: LinkPageLocale; theme: LinkPageTheme }) => {
	const document = applyLinkPageTheme({ document: customerDocuments.get(theme.id) ?? storyDocument, theme });

	const brand = resolveLinkPageBrand({
		brandOverride: document.appearance.brandOverride,
		inheritedBrand: defaultLinkPageBrand,
	});

	return <LinkPageRenderer brand={brand} document={document} locale={locale} preview />;
};

const categoryOptions = ["all", ...linkPageThemeCategories] as const;

const ThemeGallery = ({ category, locale }: { category: (typeof categoryOptions)[number]; locale: LinkPageLocale }) => (
	<ol className='grid grid-cols-[repeat(auto-fill,minmax(13.75rem,1fr))] gap-x-5 gap-y-8 bg-neutral-100 p-6'>
		{linkPageThemes
			.filter((theme) => category === "all" || theme.category === category)
			.map((theme, index) => (
				<li
					className='flex flex-col gap-2 [content-visibility:auto] [contain-intrinsic-size:auto_36rem]'
					key={theme.id}
				>
					<div className='relative h-[29rem] w-[13.75rem] overflow-hidden rounded-3xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_12px_32px_rgb(0_0_0/0.12)]'>
						<div className='absolute start-0 top-0 h-[51.5rem] w-[24.375rem] origin-top-left scale-[0.5641] overflow-hidden rtl:origin-top-right'>
							<ThemedPage locale={locale} theme={theme} />
						</div>
					</div>
					<p className='text-xs/5 text-neutral-900'>
						<span className='font-semibold'>
							{index + 1}. {theme.id}
						</span>
						<span className='block text-neutral-500'>{theme.description}</span>
					</p>
				</li>
			))}
	</ol>
);

const meta = {
	args: { category: "all", locale: "en" },
	argTypes: {
		category: { control: "select", options: categoryOptions },
		locale: { control: "inline-radio", options: defaultLinkPageBrand.locales },
	},
	component: ThemeGallery,
	parameters: { layout: "fullscreen" },
	title: "Links/Themes",
} satisfies Meta<typeof ThemeGallery>;

export default meta;

export const Gallery: StoryObj<typeof meta> = {};

export const Theme: StoryObj<{ locale: LinkPageLocale; themeId: string }> = {
	args: { locale: "en", themeId: linkPageThemes[0]?.id },
	argTypes: {
		themeId: { control: "select", options: linkPageThemes.map(({ id }) => id) },
	},
	render: ({ locale, themeId }) => {
		const theme = linkPageThemes.find(({ id }) => id === themeId) ?? linkPageThemes[0];

		return <div className='h-dvh overflow-y-auto'>{theme && <ThemedPage locale={locale} theme={theme} />}</div>;
	},
};
