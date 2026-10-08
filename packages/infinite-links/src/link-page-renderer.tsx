import type { CSSProperties, ReactNode } from "react";

import type { BrandFoundationV1 } from "@starter/infinite-brand";
import { resolveTextDirection, themeToCssVariables } from "@starter/infinite-website/theme";

import {
	type LinkPageButtonAppearance,
	type LinkPageDocument,
	type LinkPageLocale,
	type LinkPageSectionAppearance,
	type LinkPageSocial,
	type LinkPageSocialsBlock,
	type LinkPageBanner,
	type LinkPageStudioLayout,
	type LinkPageSurfaceAppearance,
} from "./contracts";
import { LinkPageActions } from "./link-page-client-blocks";
import {
	LinkPageAnnouncementBlock as AnnouncementBlock,
	LinkPageCountdownBlock as CountdownBlock,
	LinkPageEmbedBlock as EmbedBlock,
	LinkPageFaqBlock as FaqBlock,
	LinkPageFormBlock as FormBlock,
	LinkPageHeaderBlock as HeaderBlock,
	LinkPageMarqueeBlock as MarqueeBlock,
	linkPageRuntimeCopy,
	LinkPageTabsBlock as TabsBlock,
	LinkPageTestimonialsBlock as TestimonialsBlock,
	LinkPageTextBlock as TextBlock,
	LinkPageVideoBlock as VideoBlock,
} from "./link-page-content-blocks";
import { resolveLinkPageCopy, type ResolvedLinkPageBlock } from "./link-page-copy";
import {
	linkPageAnchorProps as anchorProps,
	LinkPageCollectionBlock as CollectionBlock,
	linkPageFocusClassName as focusClassName,
	LinkPageLinkButton as LinkButton,
	linkPageRadiusClassName as radiusClassName,
	type LinkPageRenderContext as RenderContext,
	type LinkPageTextElementProps,
	type LinkPageTextTarget,
} from "./link-page-link-blocks";
import { LinkPageProfileHeader as ProfileHeader } from "./link-page-profile";
import { LinkPageShaderWallpaper } from "./link-page-shader-wallpaper";
import { LinkPageStudioProfile } from "./link-page-studio-profile";
import {
	hasLinkPageStudioButtons,
	isLinkPageStudioLayout,
	linkPageButtonVariables as resolveButtonVariables,
	linkPageDividerVariables,
	linkPageFontScales,
	linkPageStudioButtonClassName,
	linkPageStudioGap,
	linkPageStudioSurface,
} from "./link-page-studio-style";
import { projectLinkPageTheme } from "./link-page-theme-projection";
import { LinkPageWallpaper, linkPageWallpaperStyle } from "./link-page-wallpaper";
import { LinkPageSocialIcon, linkPageSocialPlatformLabels } from "./social-icons";

export type LinkPageInsertionTarget = {
	index: number;
	placement: "header" | "page";
};

export type { LinkPageTextElementProps, LinkPageTextTarget } from "./link-page-link-blocks";

export type LinkPageRendererProps = {
	brand: BrandFoundationV1;
	document: LinkPageDocument;
	locale: LinkPageLocale;
	pageUrl?: string;
	preview?: boolean;
	renderBlockControls?: (block: ResolvedLinkPageBlock) => ReactNode;
	renderInsertionControl?: (target: LinkPageInsertionTarget) => ReactNode;
	renderProfileControls?: () => ReactNode;
	textElementProps?: (target: LinkPageTextTarget) => LinkPageTextElementProps | undefined;
};

type CSSVariables = CSSProperties & Record<`--${string}`, string | number | undefined>;

const buttonStyleClassNames = {
	glass: "border-[color-mix(in_srgb,var(--foreground-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--surface-canvas)_48%,transparent)] text-[var(--lp-button-text)] backdrop-blur-md",
	outline: "border-2 border-[var(--lp-button)] bg-transparent text-[var(--lp-button-text)]",
	soft: "border-transparent bg-[var(--lp-button-fill)] text-[var(--lp-button-text)]",
	solid: "border-transparent bg-[var(--lp-button-fill)] text-[var(--lp-button-text)]",
} satisfies Record<LinkPageButtonAppearance["style"], string>;

const buttonShadowClassNames = {
	hard: "shadow-[4px_4px_0_0_var(--lp-button-shadow)]",
	none: "",
	strong: "shadow-[0_10px_28px_rgb(0_0_0/0.22)]",
	subtle: "shadow-[0_2px_10px_rgb(0_0_0/0.12)]",
} satisfies Record<LinkPageButtonAppearance["shadow"], string>;

const resolveButtonClassName = (buttons: LinkPageButtonAppearance) =>
	`${hasLinkPageStudioButtons(buttons) ? linkPageStudioButtonClassName : `${radiusClassName} ${buttonStyleClassNames[buttons.style]} ${buttonShadowClassNames[buttons.shadow]} border`} ${buttons.textTransform === "uppercase" ? "uppercase tracking-[0.08em]" : ""} transition-[filter,transform,box-shadow] duration-150 hover:brightness-[0.97] motion-safe:hover:-translate-y-px motion-reduce:transition-none ${focusClassName}`;

const resolveSurfaceStyle = ({
	appearance,
	fallbackBackground,
}: {
	appearance: LinkPageSurfaceAppearance;
	fallbackBackground: string;
}): CSSVariables => ({
	"--foreground-muted": appearance.foregroundColor
		? `color-mix(in srgb, ${appearance.foregroundColor} 68%, transparent)`
		: undefined,
	"--foreground-primary": appearance.foregroundColor ?? undefined,
	backgroundColor: appearance.style === "plain" ? undefined : (appearance.backgroundColor ?? fallbackBackground),
	color: appearance.foregroundColor ?? undefined,
});

const BlockContent = ({ block, context }: { block: ResolvedLinkPageBlock; context: RenderContext }) => {
	switch (block.kind) {
		case "announcement":
			return <AnnouncementBlock block={block} context={context} />;
		case "collection":
			return <CollectionBlock block={block} context={context} />;
		case "countdown":
			return <CountdownBlock block={block} context={context} />;
		case "embed":
			return <EmbedBlock block={block} context={context} />;
		case "faq":
			return <FaqBlock block={block} context={context} />;
		case "form":
			return <FormBlock block={block} context={context} />;
		case "header":
			return <HeaderBlock block={block} context={context} />;
		case "link":
			return <LinkButton blockId={block.id} context={context} link={block} />;
		case "marquee":
			return <MarqueeBlock block={block} />;
		case "socials":
			return <Socials context={context} display={block.display} socials={block.items} />;
		case "tabs":
			return <TabsBlock block={block} context={context} />;
		case "testimonials":
			return <TestimonialsBlock block={block} context={context} />;
		case "text":
			return <TextBlock block={block} context={context} standaloneSurface={block.appearance.style === "plain"} />;
		case "video":
			return <VideoBlock block={block} context={context} />;
	}
};

const sectionStyleClassNames = {
	band: "-mx-5 w-[calc(100%+2.5rem)] px-5 py-6 sm:-mx-8 sm:w-[calc(100%+4rem)] sm:px-8",
	card: `${radiusClassName} w-full p-5`,
	plain: "w-full",
} satisfies Record<LinkPageSectionAppearance["style"], string>;

const sectionAlignmentClassNames = {
	center: "items-center text-center",
	inherit: "",
	start: "items-start text-start",
} satisfies Record<LinkPageSectionAppearance["alignment"], string>;

type SectionBlockProps = { block: ResolvedLinkPageBlock; context: RenderContext };

const SectionBlock = ({ block, context }: SectionBlockProps) => {
	const { appearance } = block;
	const centered = appearance.alignment === "inherit" ? context.centered : appearance.alignment === "center";

	const scopedContext = {
		...context,
		buttonClassName: appearance.buttons ? resolveButtonClassName(appearance.buttons) : context.buttonClassName,
		buttonDesign: appearance.buttons ? appearance.buttons.design : context.buttonDesign,
		buttons: appearance.buttons ?? context.buttons,
		centered,
		showImages: appearance.buttons ? appearance.buttons.showImages === true : context.showImages,
	};

	const style = resolveSurfaceStyle({
		appearance,
		fallbackBackground:
			appearance.style === "card"
				? "color-mix(in srgb, var(--foreground-primary) 7%, transparent)"
				: "var(--surface-featured)",
	});

	if (appearance.buttons) {
		Object.assign(style, resolveButtonVariables({ buttons: appearance.buttons, surface: context.surface }));
	}

	return (
		<div
			className={`${sectionStyleClassNames[appearance.style]} ${sectionAlignmentClassNames[appearance.alignment]} flex flex-col`}
			data-links-section-style={appearance.style}
			style={style}
		>
			<BlockContent block={block} context={scopedContext} />
		</div>
	);
};

const searchText = (block: ResolvedLinkPageBlock) => {
	if (block.kind === "link") {
		return `${block.label} ${block.description ?? ""}`.toLowerCase();
	}

	if (block.kind === "collection") {
		return `${block.title} ${block.links.map((link) => link.label).join(" ")}`.toLowerCase();
	}

	if ("text" in block) {
		return block.text.toLowerCase();
	}

	return "title" in block ? block.title.toLowerCase() : "";
};

const BlockFrame = ({
	block,
	children,
	first,
	index,
	placement,
	renderBlockControls,
	renderInsertionControl,
	searchable,
}: {
	block: ResolvedLinkPageBlock;
	children: ReactNode;
	first: boolean;
	index: number;
	placement: LinkPageInsertionTarget["placement"];
	renderBlockControls?: LinkPageRendererProps["renderBlockControls"];
	renderInsertionControl?: LinkPageRendererProps["renderInsertionControl"];
	searchable: boolean;
}) => {
	const search = searchable ? searchText(block) : undefined;

	if (!renderBlockControls && !renderInsertionControl) {
		return (
			<li className='w-full' data-links-search={search}>
				{children}
			</li>
		);
	}

	return (
		<li className='group/links-block relative w-full' data-links-block-id={block.id} data-links-search={search}>
			{first && renderInsertionControl && (
				<div className='group/links-insertion absolute inset-x-0 bottom-full h-8 w-full group/button-reveal'>
					{renderInsertionControl({ index, placement })}
				</div>
			)}
			<div className='flex items-center justify-center px-5 sm:px-8' data-links-block-content=''>
				{children}
			</div>
			{renderBlockControls?.(block)}
			{renderInsertionControl && (
				<div className='group/links-insertion relative h-3 w-full group/button-reveal pointer-coarse:group-last/links-block:h-12'>
					{renderInsertionControl({ index: index + 1, placement })}
				</div>
			)}
		</li>
	);
};

const blockListMargins = {
	default: { header: "mt-5", page: "mt-8" },
	studio: { header: "mt-[33px]", page: "mt-0" },
} as const;

const BlockList = ({
	blockIndexes,
	blocks,
	context,
	emptyInsertion,
	region,
	renderBlockControls,
	renderInsertionControl,
}: {
	blockIndexes: Map<string, number>;
	blocks: Array<ResolvedLinkPageBlock>;
	context: RenderContext;
	emptyInsertion?: boolean;
	region: "header" | "page";
	renderBlockControls?: LinkPageRendererProps["renderBlockControls"];
	renderInsertionControl?: LinkPageRendererProps["renderInsertionControl"];
}) => {
	if (blocks.length === 0 && !emptyInsertion) {
		return null;
	}

	return (
		<ul
			className={`${blockListMargins[context.studio ? "studio" : "default"][region]} flex flex-col ${renderBlockControls ? "-mx-5 w-[calc(100%+2.5rem)] sm:-mx-8 sm:w-[calc(100%+4rem)]" : "w-full"} ${renderInsertionControl ? "gap-0" : "gap-[var(--lp-gap,0.75rem)]"}`}
			data-links-header-blocks={region === "header" ? "" : undefined}
		>
			{blocks.map((block, regionIndex) => (
				<BlockFrame
					block={block}
					first={regionIndex === 0}
					index={blockIndexes.get(block.id) ?? regionIndex}
					key={block.id}
					placement={region}
					renderBlockControls={renderBlockControls}
					renderInsertionControl={renderInsertionControl}
					searchable={context.searchable}
				>
					<SectionBlock block={block} context={context} />
				</BlockFrame>
			))}
			{blocks.length === 0 && renderInsertionControl && (
				<li className='group/links-insertion relative h-12 w-full list-none group/button-reveal'>
					{renderInsertionControl({ index: 0, placement: region })}
				</li>
			)}
		</ul>
	);
};

const socialClassNames = {
	chips: { icon: "size-4", link: "h-9 gap-1.5 border border-current/30 px-3 text-xs font-semibold" },
	icons: { icon: "size-6", link: "size-11 justify-center" },
	studio: { icon: "size-[2.4em]", link: "size-[calc(2.4em+14px)] justify-center" },
} as const;

const resolveSocialVariant = ({ display, studio }: { display: LinkPageSocialsBlock["display"]; studio: boolean }) => {
	if (display === "chips") {
		return "chips";
	}

	return studio ? "studio" : "icons";
};

const Socials = ({
	context,
	display = "icons",
	socials,
}: {
	context: RenderContext;
	display?: LinkPageSocialsBlock["display"];
	socials: Array<LinkPageSocial>;
}) => {
	if (socials.length === 0) {
		return null;
	}

	const socialVariant = resolveSocialVariant({ display, studio: context.studio });

	return (
		<ul
			className={`flex w-full flex-wrap items-center ${context.studio ? "gap-0 text-[calc(10px+10px*var(--lp-social-size,0))]" : "gap-2"} ${context.centered ? "justify-center" : "justify-start"}`}
		>
			{socials.map((social) => (
				<li key={social.id}>
					<a
						{...anchorProps({ context, href: social.url })}
						aria-label={linkPageSocialPlatformLabels[social.platform]}
						className={`${socialClassNames[socialVariant].link} flex items-center rounded-full text-[var(--foreground-primary)] transition-[background-color,opacity] hover:bg-[color-mix(in_srgb,var(--foreground-primary)_8%,transparent)] ${focusClassName}`}
						data-links-link-id={context.preview ? undefined : social.id}
						title={linkPageSocialPlatformLabels[social.platform]}
					>
						<LinkPageSocialIcon
							className={socialClassNames[socialVariant].icon}
							platform={social.platform}
						/>
						{display === "chips" && linkPageSocialPlatformLabels[social.platform]}
					</a>
				</li>
			))}
		</ul>
	);
};

const headerStyleClassNames = {
	band: "w-full pb-8",
	card: `${radiusClassName} mt-5 w-[calc(100%-2.5rem)] max-w-2xl overflow-hidden pb-8 sm:w-[calc(100%-4rem)]`,
	plain: "w-full",
} satisfies Record<LinkPageSurfaceAppearance["style"], string>;

const PageShader = ({ wallpaper }: { wallpaper: LinkPageDocument["appearance"]["wallpaper"] }) => {
	if (wallpaper.animation) {
		return <LinkPageShaderWallpaper animation={wallpaper.animation} />;
	}

	return wallpaper.style === "animated" ? <LinkPageWallpaper wallpaper={wallpaper} /> : null;
};

const resolveTypographyVariables = (typography: LinkPageDocument["appearance"]["typography"]): CSSVariables =>
	typography
		? {
				"--lp-body-scale": linkPageFontScales.get(typography.body.fontId) ?? 1,
				"--lp-body-style": typography.body.italic ? "italic" : "normal",
				"--lp-heading-scale": linkPageFontScales.get(typography.heading.fontId) ?? 1,
				"--lp-heading-style": typography.heading.italic ? "italic" : "normal",
			}
		: {};

const ProfileBackdrop = ({ banner, fallback }: { banner: LinkPageBanner | null | undefined; fallback: ReactNode }) =>
	banner ? (
		<div aria-hidden='true' className='absolute inset-0' style={linkPageWallpaperStyle({ wallpaper: banner })}>
			<PageShader wallpaper={banner} />
		</div>
	) : (
		fallback
	);

type PageBackgrounds = { column: CSSProperties; page: CSSProperties; shader: "column" | "page" };

const resolvePageBackgrounds = ({
	appearance,
	layout,
	wallpaper,
}: {
	appearance: LinkPageDocument["appearance"];
	layout: LinkPageStudioLayout | null;
	wallpaper: CSSProperties;
}): PageBackgrounds => {
	const desktopColor = layout === null ? undefined : appearance.wallpaper.desktopColor;
	const page = desktopColor ? { backgroundColor: desktopColor } : wallpaper;

	return desktopColor ? { column: wallpaper, page, shader: "column" } : { column: {}, page, shader: "page" };
};

const resolvePageChrome = ({
	blocks,
	context,
	locale,
	pageUrl,
	profile,
	title,
}: {
	blocks: Array<ResolvedLinkPageBlock>;
	context: RenderContext;
	locale: string;
	pageUrl: string | undefined;
	profile: LinkPageDocument["profile"];
	title: string;
}) => {
	const announcements = blocks.filter((block) => block.kind === "announcement" && !context.textElementProps);
	const actions = profile.actions ?? { contact: false, search: false, share: false };
	const menu = blocks.flatMap((block) => (block.kind === "tabs" ? block.items : []));
	const visible = actions.contact || actions.search || actions.share || menu.length > 0;

	return {
		actionsBar: visible ? (
			<LinkPageActions
				actions={actions}
				labels={linkPageRuntimeCopy(locale)}
				menu={menu}
				title={title}
				url={pageUrl ?? ""}
			/>
		) : null,
		announcements,
		banners: announcements
			.filter((block) => block.kind === "announcement" && block.layout === "banner")
			.map((block) => <BlockContent block={block} context={context} key={block.id} />),
		cards: announcements
			.filter((block) => block.kind === "announcement" && block.layout === "card")
			.map((block) => <BlockContent block={block} context={context} key={block.id} />),
	};
};

const partitionBlocks = ({
	blocks,
	headerBlockIds,
	socialsAtBottom,
}: {
	blocks: Array<ResolvedLinkPageBlock>;
	headerBlockIds: ReadonlyArray<string>;
	socialsAtBottom: boolean;
}) => {
	const headerBlocks = blocks.filter(
		(block) => headerBlockIds.includes(block.id) && !(socialsAtBottom && block.kind === "socials")
	);

	const pageBlocks = blocks.filter((block) => !headerBlocks.includes(block));

	return {
		headerBlocks,
		pageBlocks: socialsAtBottom
			? [
					...pageBlocks.filter((block) => block.kind !== "socials"),
					...pageBlocks.filter((block) => block.kind === "socials"),
				]
			: pageBlocks,
	};
};

const resolveProfileLogo = ({ brand, document }: Pick<LinkPageRendererProps, "brand" | "document">) =>
	document.profile.imageUrl ? undefined : brand.logo;

export const LinkPageRenderer = ({
	brand,
	document,
	locale,
	pageUrl,
	preview = false,
	renderBlockControls,
	renderInsertionControl,
	renderProfileControls,
	textElementProps,
}: LinkPageRendererProps) => {
	const logo = resolveProfileLogo({ brand, document });
	const copy = resolveLinkPageCopy({ brand, document, locale });
	const direction = resolveTextDirection({ locale });
	const theme = projectLinkPageTheme({ appearance: document.appearance, brand });
	const { appearance, profile } = document;
	const studio = isLinkPageStudioLayout(profile.layout) ? profile.layout : null;
	const wallpaper = linkPageWallpaperStyle({ wallpaper: appearance.wallpaper });
	const centered = profile.alignment === "center";
	const hero = profile.layout === "hero";
	const surface = linkPageStudioSurface({ appearance, background: brand.colors.background, layout: studio });

	const context: RenderContext = {
		buttonClassName: resolveButtonClassName(appearance.buttons),
		buttonDesign: appearance.buttons.design,
		buttons: appearance.buttons,
		centered,
		locale,
		preview,
		searchable: profile.actions?.search === true,
		showImages: appearance.buttons.showImages === true,
		studio: studio !== null,
		surface,
		textElementProps,
	};

	const renderedBlocks = renderBlockControls
		? copy.blocks
		: copy.blocks.filter((block) => block.enabled && (block.kind !== "socials" || block.items.length > 0));

	const chrome = resolvePageChrome({ blocks: renderedBlocks, context, locale, pageUrl, profile, title: copy.title });

	const { headerBlocks, pageBlocks } = partitionBlocks({
		blocks: renderedBlocks.filter((block) => !chrome.announcements.includes(block)),
		headerBlockIds: document.headerBlockIds,
		socialsAtBottom: appearance.socialsAtBottom === true,
	});

	const { actionsBar, banners, cards } = chrome;
	const backgrounds = resolvePageBackgrounds({ appearance, layout: studio, wallpaper });
	const blockIndexes = new Map(renderedBlocks.map((block, index) => [block.id, index]));

	const style: CSSVariables = {
		...themeToCssVariables({ locale, theme }),
		...resolveButtonVariables({ buttons: appearance.buttons, surface }),
		...resolveTypographyVariables(appearance.typography),
		...linkPageDividerVariables(appearance.divider),
		"--lp-gap": linkPageStudioGap(appearance.buttons),
		"--lp-social-size": appearance.socialIconSize,
		...backgrounds.page,
	};

	const headerStyle = {
		...resolveSurfaceStyle({ appearance: appearance.header, fallbackBackground: "var(--surface-featured)" }),
		"--lp-header-background":
			appearance.header.style === "plain"
				? "var(--surface-canvas)"
				: (appearance.header.backgroundColor ?? "var(--surface-featured)"),
	};

	const profileHero = hero && (
		<div
			className='relative col-start-1 row-start-1 h-[min(72cqw,26rem)] w-full max-w-2xl overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]'
			data-links-profile-hero=''
		>
			<ProfileBackdrop
				banner={appearance.banner}
				fallback={
					<div
						aria-hidden='true'
						className='absolute inset-0 bg-[linear-gradient(145deg,var(--surface-featured),var(--action-primary))]'
					/>
				}
			/>
		</div>
	);

	const headerBlockList = (
		<BlockList
			blockIndexes={blockIndexes}
			blocks={headerBlocks}
			context={context}
			region='header'
			renderBlockControls={renderBlockControls}
			renderInsertionControl={renderInsertionControl}
		/>
	);

	const pageBlockList = (
		<div
			className={`relative z-[2] flex w-full flex-col ${studio ? "max-w-[530px] px-[16.5px] pb-16 @[600px]:px-[33px]" : "max-w-xl px-5 pb-12 sm:px-8 sm:pb-16"} ${centered ? "items-center text-center" : "items-start text-start"}`}
		>
			<BlockList
				blockIndexes={blockIndexes}
				blocks={pageBlocks}
				context={context}
				emptyInsertion={Boolean(renderInsertionControl) && pageBlocks.length === 0}
				region='page'
				renderBlockControls={renderBlockControls}
				renderInsertionControl={renderInsertionControl}
			/>
		</div>
	);

	return (
		<main
			className={`${preview ? "min-h-full" : "min-h-dvh"} website-container @container relative flex w-full flex-col items-center overflow-x-hidden text-[var(--foreground-primary)] [font-family:var(--website-font-body)]`}
			data-link-page-wallpaper={appearance.wallpaper.style}
			dir={direction}
			lang={locale}
			style={style}
		>
			{backgrounds.shader === "page" && <PageShader wallpaper={appearance.wallpaper} />}
			{banners}
			{!studio && actionsBar}
			{studio ? (
				<div
					className={`relative flex w-full flex-1 flex-col items-center @[600px]:max-w-[530px] ${backgrounds.shader === "column" ? "@[600px]:shadow-[0_7px_29px_0_rgba(100,100,111,0.15)]" : ""}`}
					data-links-column=''
					style={backgrounds.column}
				>
					{backgrounds.shader === "column" && <PageShader wallpaper={appearance.wallpaper} />}
					{actionsBar}
					<div
						className={`${renderProfileControls ? "group/links-profile" : ""} relative w-full`}
						data-links-profile={renderProfileControls ? "" : undefined}
					>
						{renderProfileControls?.()}
						<LinkPageStudioProfile
							backdrop={
								<ProfileBackdrop
									banner={appearance.banner}
									fallback={
										<div
											aria-hidden='true'
											className='absolute inset-0 bg-[var(--surface-featured)]'
										/>
									}
								/>
							}
							bio={copy.bio}
							context={context}
							document={document}
							layout={studio}
							logo={logo}
							pageColor={surface}
							tagline={copy.tagline}
							title={copy.title}
						>
							{headerBlockList}
						</LinkPageStudioProfile>
					</div>
					{pageBlockList}
				</div>
			) : (
				<>
					<div
						className={`${renderProfileControls ? "group/links-profile" : ""} ${headerStyleClassNames[appearance.header.style]} relative grid grid-cols-1 justify-items-center`}
						data-links-profile={renderProfileControls ? "" : undefined}
						data-links-profile-layout={profile.layout}
						data-links-section-style={appearance.header.style}
						style={headerStyle}
					>
						{renderProfileControls?.()}
						{profileHero}
						<div
							className={`relative col-start-1 row-start-1 flex min-w-0 w-full max-w-xl flex-col ${profile.layout === "classic" || hero ? "px-5 pt-12 sm:px-8 sm:pt-16" : "px-5 pt-6 sm:px-8"} ${centered ? "items-center text-center" : "items-start text-start"}`}
						>
							<ProfileHeader
								bio={copy.bio}
								context={context}
								document={document}
								logo={logo}
								title={copy.title}
							/>
							{headerBlockList}
						</div>
					</div>
					{pageBlockList}
				</>
			)}
			{cards}
		</main>
	);
};
