import type { CSSProperties, HTMLAttributes, MouseEvent, ReactNode } from "react";

import { linkPageLimits, type LinkPageButtonAppearance, type LinkPageLinkDesign } from "./contracts";
import { LinkPageBounce } from "./link-page-client-blocks";
import { type ResolvedLinkPageBlock, type ResolvedLinkPageLink } from "./link-page-copy";
import { linkPageDesignClasses } from "./link-page-designs";
import { linkPageLinkStyleVariables } from "./link-page-studio-style";

export type LinkPageTextTarget =
	| { content: string; field: "bio" | "tagline" | "title"; kind: "profile"; maxLength: number; multiline: boolean }
	| {
			blockId: string;
			content: string;
			field: "buttonLabel" | "label" | "text" | "title";
			kind: "block";
			maxLength: number;
			multiline: boolean;
	  }
	| {
			blockId: string;
			content: string;
			field: "label";
			kind: "collectionLink";
			linkId: string;
			maxLength: number;
			multiline: false;
	  };

export type LinkPageTextElementProps = Omit<HTMLAttributes<HTMLElement>, "children" | "className" | "style"> &
	Partial<Record<`data-${string}`, string | number | undefined>>;

export type LinkPageRenderContext = {
	buttonClassName: string;
	buttonDesign?: LinkPageLinkDesign;
	buttons: LinkPageButtonAppearance;
	centered: boolean;
	locale: string;
	preview: boolean;
	searchable: boolean;
	showImages: boolean;
	studio: boolean;
	surface: string;
	textElementProps?: (target: LinkPageTextTarget) => LinkPageTextElementProps | undefined;
};

export const linkPageSurfaceClassName = "bg-[color-mix(in_srgb,var(--foreground-primary)_7%,transparent)]";

export const linkPageRadiusClassName = "rounded-[var(--website-radius)]";

export const linkPageFocusClassName =
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--foreground-primary)]";

export const linkPageStudioHeadingClassName =
	"[font-family:var(--website-font-brand)] [font-weight:var(--website-heading-weight)] [font-style:var(--lp-heading-style,normal)]";

export const linkPageStudioBodyClassName =
	"[font-family:var(--website-font-body)] [font-weight:var(--website-body-weight)] [font-style:var(--lp-body-style,normal)]";

const studioLabelClassName = `text-[calc(16px*var(--lp-heading-scale,1))] leading-[1.3] ${linkPageStudioHeadingClassName}`;

const studioDescriptionClassName = `mt-[6px] text-[calc(12.6px*var(--lp-body-scale,1))] leading-[1.3] ${linkPageStudioBodyClassName}`;

const preventNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
	event.preventDefault();
};

export const linkPageAnchorProps = ({ context, href }: { context: LinkPageRenderContext; href: string }) => ({
	"aria-disabled": context.preview || undefined,
	href,
	onClick: context.preview ? preventNavigation : undefined,
	rel: "noopener noreferrer",
	tabIndex: context.preview ? -1 : undefined,
	target: "_blank",
});

export const LinkPageLinkSurface = ({
	children,
	className,
	context,
	href,
	linkId,
	style,
}: {
	children: ReactNode;
	className: string;
	context: LinkPageRenderContext;
	href: string;
	linkId: string;
	style?: CSSProperties;
}) => {
	if (context.textElementProps || !href) {
		return (
			<div className={className} style={style}>
				{children}
			</div>
		);
	}

	return (
		<a
			{...linkPageAnchorProps({ context, href })}
			className={className}
			data-links-link-id={context.preview ? undefined : linkId}
			style={style}
		>
			{children}
		</a>
	);
};

const resolveLinkLabelTarget = ({
	blockId,
	link,
}: {
	blockId: string;
	link: ResolvedLinkPageLink;
}): LinkPageTextTarget =>
	blockId === link.id
		? {
				blockId,
				content: link.label,
				field: "label",
				kind: "block",
				maxLength: linkPageLimits.label,
				multiline: false,
			}
		: {
				blockId,
				content: link.label,
				field: "label",
				kind: "collectionLink",
				linkId: link.id,
				maxLength: linkPageLimits.label,
				multiline: false,
			};

const LinkBadge = ({ badge, studio = false }: { badge?: string; studio?: boolean }) =>
	badge ? (
		<span
			className={
				studio
					? "absolute end-[17px] top-[17px] z-10 max-w-[70%] truncate rounded-[4px] bg-[var(--lp-label)] px-[9px] py-[6px] text-[15px] leading-none font-bold normal-case tracking-normal text-[var(--lp-label-text)] shadow-[0_2px_4px_rgba(76,76,75,0.1)]"
					: "absolute end-2 top-2 z-10 max-w-[60%] truncate rounded-full bg-[var(--foreground-primary)] px-2 py-0.5 text-[0.6875rem] font-semibold normal-case tracking-normal text-[var(--surface-canvas)]"
			}
		>
			{badge}
		</span>
	) : null;

const LinkCta = ({ cta }: { cta?: string }) =>
	cta ? (
		<span className='mt-[6px] inline-block rounded-[4px] bg-[var(--lp-cta)] px-[22px] py-[11px] text-[15px] leading-[1.2] font-bold text-[var(--lp-cta-text)]'>
			{cta}
		</span>
	) : null;

const EmojiTile = ({ className, emoji }: { className: string; emoji: string }) => (
	<span aria-hidden='true' className={`${className} flex items-center justify-center`}>
		<svg className='size-full' viewBox='0 0 100 100'>
			<text dominantBaseline='central' fontSize='60' textAnchor='middle' x='50' y='52'>
				{emoji}
			</text>
		</svg>
	</span>
);

const alignClassNames = { center: "text-center!", end: "text-end!", start: "text-start!" } as const;

const resolveLinkStyle = ({ context, link }: { context: LinkPageRenderContext; link: ResolvedLinkPageLink }) =>
	link.style
		? linkPageLinkStyleVariables({ buttons: context.buttons, style: link.style, surface: context.surface })
		: undefined;

const ClassicLink = ({
	context,
	link,
	target,
}: {
	context: LinkPageRenderContext;
	link: ResolvedLinkPageLink;
	target: LinkPageTextTarget;
}) => (
	<LinkPageLinkSurface
		className={`${context.buttonClassName} relative flex min-h-14 w-full flex-col items-center justify-center px-14 py-3 text-center text-sm font-semibold`}
		context={context}
		href={link.url}
		linkId={link.id}
	>
		{context.showImages && link.imageUrl && (
			<img
				alt=''
				className='absolute start-3 size-9 rounded-[calc(var(--website-radius)/2)] object-cover'
				loading='lazy'
				src={link.imageUrl}
			/>
		)}
		<LinkBadge badge={link.badge} />
		<span {...context.textElementProps?.(target)} className='line-clamp-2'>
			{link.label}
		</span>
		{link.description && <span className='mt-1 text-xs font-normal opacity-75'>{link.description}</span>}
	</LinkPageLinkSurface>
);

const FeaturedLink = ({
	context,
	link,
	target,
}: {
	context: LinkPageRenderContext;
	link: ResolvedLinkPageLink;
	target: LinkPageTextTarget;
}) => (
	<LinkPageLinkSurface
		className={`${context.buttonClassName} relative flex w-full flex-col overflow-hidden p-0 text-start`}
		context={context}
		href={link.url}
		linkId={link.id}
	>
		{context.showImages && link.imageUrl && (
			<img alt='' className='aspect-video w-full object-cover' loading='lazy' src={link.imageUrl} />
		)}
		<LinkBadge badge={link.badge} />
		<span
			{...context.textElementProps?.(target)}
			className='flex min-h-28 w-full items-center justify-center px-6 py-6 text-center text-lg font-semibold'
		>
			{link.label}
		</span>
		{link.description && <span className='px-6 pb-4 text-center text-sm opacity-75'>{link.description}</span>}
	</LinkPageLinkSurface>
);

const DesignedLinkMedia = ({
	classes,
	context,
	design,
	link,
	studio,
}: {
	classes: (typeof linkPageDesignClasses)[LinkPageLinkDesign];
	context: LinkPageRenderContext;
	design: LinkPageLinkDesign;
	link: ResolvedLinkPageLink;
	studio: boolean;
}) => {
	const decoration = "decoration" in classes ? classes.decoration : undefined;

	if (context.showImages && link.imageUrl) {
		return (
			<>
				<img alt='' className={`${classes.image} object-cover`} loading='lazy' src={link.imageUrl} />
				{decoration === "overlay" && (
					<span
						aria-hidden='true'
						className='absolute inset-0 [background:var(--lp-button-fill)] opacity-50'
					/>
				)}
			</>
		);
	}

	if (link.emoji && studio && design === "buttons-10") {
		return <EmojiTile className={classes.image} emoji={link.emoji} />;
	}

	if (!context.showImages || studio) {
		return null;
	}

	return (
		<span
			aria-hidden='true'
			className={`${classes.image} flex items-center justify-center bg-[color-mix(in_srgb,currentColor_12%,transparent)]`}
		>
			<svg className='size-6 opacity-40' fill='none' stroke='currentColor' strokeWidth='1.5' viewBox='0 0 24 24'>
				<rect height='16' rx='2' width='18' x='3' y='4' />
				<path d='m3 16 5-5 4 4 3-3 6 6' />
				<circle cx='16' cy='8' r='1' />
			</svg>
		</span>
	);
};

const DesignedLinkText = ({
	className,
	context,
	inlineEmoji,
	link,
	studio,
	target,
}: {
	className: string;
	context: LinkPageRenderContext;
	inlineEmoji: boolean;
	link: ResolvedLinkPageLink;
	studio: boolean;
	target: LinkPageTextTarget;
}) => (
	<span
		className={`${className} min-w-0 ${studio ? "" : "text-sm"} ${link.align ? alignClassNames[link.align] : ""}`}
	>
		<span
			key={link.label}
			{...context.textElementProps?.(target)}
			className={`block text-pretty break-words ${studio ? studioLabelClassName : "font-semibold"}`}
		>
			{inlineEmoji && <span className='me-[6px]'>{link.emoji}</span>}
			{link.label}
		</span>
		{link.description && (
			<span
				className={`block ${studio ? studioDescriptionClassName : "mt-1 text-xs leading-relaxed opacity-75"}`}
			>
				{link.description}
			</span>
		)}
		<LinkCta cta={link.cta} />
	</span>
);

const Decoration = ({ decoration }: { decoration: string | undefined }) => {
	if (decoration === "browser") {
		return (
			<span
				aria-hidden='true'
				className='absolute inset-x-0 top-0 z-10 flex h-6 items-center gap-1 bg-black/15 px-3'
			>
				<span className='size-1 rounded-full bg-current opacity-50' />
				<span className='size-1 rounded-full bg-current opacity-50' />
				<span className='size-1 rounded-full bg-current opacity-50' />
			</span>
		);
	}

	if (decoration === "arrow") {
		return (
			<svg
				aria-hidden='true'
				className='absolute end-3 bottom-4 size-5 rtl:-scale-x-100'
				fill='none'
				stroke='currentColor'
				strokeWidth='1.5'
				viewBox='0 0 24 24'
			>
				<path d='M5 12h14m-6-6 6 6-6 6' />
			</svg>
		);
	}

	if (decoration === "dots") {
		return (
			<span aria-hidden='true' className='pe-2 text-xl'>
				⋯
			</span>
		);
	}

	return null;
};

const DesignedLink = ({
	context,
	design,
	link,
	target,
}: {
	context: LinkPageRenderContext;
	design: LinkPageLinkDesign;
	link: ResolvedLinkPageLink;
	target: LinkPageTextTarget;
}) => {
	const classes = linkPageDesignClasses[design];
	const decoration = "decoration" in classes ? classes.decoration : undefined;
	const imageless = !context.showImages && "imageless" in classes ? classes.imageless : undefined;
	const studio = "studio" in classes;
	const emojiTile = studio && Boolean(link.emoji) && !link.imageUrl && design === "buttons-10";
	const hasText = Boolean(link.label || link.description || link.cta || context.textElementProps);

	return (
		<LinkPageLinkSurface
			className={`${context.buttonClassName} ${imageless?.item ?? classes.item} relative flex w-full min-w-0 overflow-hidden`}
			context={context}
			href={link.url}
			linkId={link.id}
			style={resolveLinkStyle({ context, link })}
		>
			<LinkBadge badge={link.badge} studio={studio} />
			{decoration === "browser" && <Decoration decoration={decoration} />}
			<DesignedLinkMedia classes={classes} context={context} design={design} link={link} studio={studio} />
			{hasText && (
				<DesignedLinkText
					className={imageless?.text ?? classes.text}
					context={context}
					inlineEmoji={Boolean(link.emoji) && !emojiTile}
					link={link}
					studio={studio}
					target={target}
				/>
			)}
			{decoration !== "browser" && <Decoration decoration={decoration} />}
		</LinkPageLinkSurface>
	);
};

const renderLink = ({
	context,
	design,
	link,
	target,
}: {
	context: LinkPageRenderContext;
	design: LinkPageLinkDesign | undefined;
	link: ResolvedLinkPageLink;
	target: LinkPageTextTarget;
}) => {
	if (design) {
		return <DesignedLink context={context} design={design} link={link} target={target} />;
	}

	if (link.layout === "featured") {
		return <FeaturedLink context={context} link={link} target={target} />;
	}

	return <ClassicLink context={context} link={link} target={target} />;
};

export const LinkPageLinkButton = ({
	blockId,
	context,
	link,
}: {
	blockId: string;
	context: LinkPageRenderContext;
	link: ResolvedLinkPageLink;
}) => {
	const target = resolveLinkLabelTarget({ blockId, link });

	const design = link.design ?? context.buttonDesign;
	const rendered = renderLink({ context, design, link, target });

	if (link.animation && !context.textElementProps) {
		return <LinkPageBounce animation={link.animation}>{rendered}</LinkPageBounce>;
	}

	return rendered;
};

const GridTile = ({
	blockId,
	context,
	link,
}: {
	blockId: string;
	context: LinkPageRenderContext;
	link: ResolvedLinkPageLink;
}) => (
	<LinkPageLinkSurface
		className={`${context.buttonClassName} relative flex aspect-square flex-col justify-end overflow-hidden p-0 text-start`}
		context={context}
		href={link.url}
		linkId={link.id}
	>
		{link.imageUrl && (
			<img alt='' className='absolute inset-0 size-full object-cover' loading='lazy' src={link.imageUrl} />
		)}
		<span
			{...context.textElementProps?.(resolveLinkLabelTarget({ blockId, link }))}
			className={`relative w-full px-3 py-3 text-center text-sm font-semibold ${link.imageUrl ? "bg-black/60 text-white" : ""}`}
		>
			{link.label}
		</span>
	</LinkPageLinkSurface>
);

const CarouselCard = ({
	blockId,
	context,
	link,
}: {
	blockId: string;
	context: LinkPageRenderContext;
	link: ResolvedLinkPageLink;
}) => (
	<LinkPageLinkSurface
		className={`${context.buttonClassName} flex w-40 shrink-0 snap-start flex-col overflow-hidden p-0 text-start`}
		context={context}
		href={link.url}
		linkId={link.id}
	>
		{link.imageUrl ? (
			<img alt='' className='aspect-[4/5] w-full object-cover' loading='lazy' src={link.imageUrl} />
		) : (
			<span
				aria-hidden='true'
				className='aspect-[4/5] w-full bg-[color-mix(in_srgb,currentColor_10%,transparent)]'
			/>
		)}
		<span
			{...context.textElementProps?.(resolveLinkLabelTarget({ blockId, link }))}
			className='line-clamp-2 px-3 py-3 text-sm font-semibold'
		>
			{link.label}
		</span>
	</LinkPageLinkSurface>
);

const CollectionLinks = ({
	blockId,
	context,
	design,
	display,
	links,
}: {
	blockId: string;
	context: LinkPageRenderContext;
	design?: LinkPageLinkDesign;
	display: Extract<ResolvedLinkPageBlock, { kind: "collection" }>["display"];
	links: Array<ResolvedLinkPageLink>;
}) => {
	if (design) {
		const classes = linkPageDesignClasses[design];

		return (
			<>
				<div className={classes.list} data-links-collection-design={design}>
					{links.map((link) => (
						<LinkPageLinkButton
							blockId={blockId}
							context={context}
							key={link.id}
							link={{ ...link, design }}
						/>
					))}
				</div>
				{"pager" in classes && links.length > 1 && (
					<span aria-hidden='true' className='mt-[11px] flex justify-center gap-[9px]'>
						{links.map((link, index) => (
							<span
								className={`size-[6px] rounded-full bg-current ${index === 0 ? "opacity-90" : "opacity-30"}`}
								key={link.id}
							/>
						))}
					</span>
				)}
			</>
		);
	}

	if (display === "grid") {
		return (
			<div className='grid grid-cols-2 gap-3'>
				{links.map((link) => (
					<GridTile blockId={blockId} context={context} key={link.id} link={link} />
				))}
			</div>
		);
	}

	if (display === "carousel") {
		return (
			<div className='-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-8 sm:px-8'>
				{links.map((link) => (
					<CarouselCard blockId={blockId} context={context} key={link.id} link={link} />
				))}
			</div>
		);
	}

	return (
		<div className='flex flex-col gap-3'>
			{links.map((link) => (
				<LinkPageLinkButton blockId={blockId} context={context} key={link.id} link={link} />
			))}
		</div>
	);
};

export const LinkPageCollectionBlock = ({
	block,
	context,
}: {
	block: Extract<ResolvedLinkPageBlock, { kind: "collection" }>;
	context: LinkPageRenderContext;
}) => {
	const titleProps = context.textElementProps?.({
		blockId: block.id,
		content: block.title,
		field: "title",
		kind: "block",
		maxLength: linkPageLimits.label,
		multiline: false,
	});

	const links = (
		<CollectionLinks
			blockId={block.id}
			context={context}
			design={block.design ?? context.buttonDesign}
			display={block.display}
			links={block.links.filter((link) => link.enabled)}
		/>
	);

	if (block.collapsible) {
		return (
			<details className='group/collection w-full' open={Boolean(context.textElementProps)}>
				<summary
					className={`${context.buttonClassName} relative flex cursor-pointer list-none items-center justify-center text-center [&::-webkit-details-marker]:hidden ${context.studio ? `px-[39.75px] py-[16.5px] ${studioLabelClassName}` : "min-h-14 px-12 py-3 text-sm font-semibold"}`}
				>
					<span {...titleProps}>{block.title}</span>
					<svg
						aria-hidden='true'
						className={`absolute transition-transform group-open/collection:rotate-180 motion-reduce:transition-none ${context.studio ? "end-[13.75px] size-5" : "end-4 size-4"}`}
						fill='none'
						stroke='currentColor'
						strokeWidth='2'
						viewBox='0 0 24 24'
					>
						<path d='m6 9 6 6 6-6' />
					</svg>
				</summary>
				<div className='pt-3'>{links}</div>
			</details>
		);
	}

	return (
		<section className='flex w-full flex-col gap-3'>
			{(block.title || context.textElementProps) && (
				<h2
					{...titleProps}
					className='text-sm font-semibold tracking-wide text-[var(--foreground-primary)] opacity-80'
				>
					{block.title}
				</h2>
			)}
			{links}
		</section>
	);
};
