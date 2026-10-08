import type { CSSProperties } from "react";

import { linkPageLimits } from "./contracts";
import { LinkPageCountdownClock, LinkPageDismissible, LinkPageMarqueeTrack } from "./link-page-client-blocks";
import { type ResolvedLinkPageBlock } from "./link-page-copy";
import { LinkPageActionIcon } from "./link-page-icons";
import {
	linkPageAnchorProps as anchorProps,
	linkPageFocusClassName as focusClassName,
	LinkPageLinkSurface as LinkSurface,
	linkPageRadiusClassName as radiusClassName,
	linkPageStudioBodyClassName as bodyClassName,
	linkPageStudioHeadingClassName as headingClassName,
	linkPageSurfaceClassName as surfaceClassName,
	type LinkPageRenderContext as RenderContext,
} from "./link-page-link-blocks";
import { LinkPageRichText } from "./link-page-rich-text";

type Block<Kind extends ResolvedLinkPageBlock["kind"]> = Extract<ResolvedLinkPageBlock, { kind: Kind }>;

const runtimeCopy = {
	ar: {
		contact: "حفظ جهة الاتصال",
		days: "يوم",
		hours: "ساعة",
		menu: "القائمة",
		minutes: "دقيقة",
		search: "بحث",
		seconds: "ثانية",
		share: "مشاركة",
		submit: "إرسال",
	},
	en: {
		contact: "Save contact",
		days: "days",
		hours: "hours",
		menu: "Menu",
		minutes: "min",
		search: "Search",
		seconds: "sec",
		share: "Share",
		submit: "Submit",
	},
} as const;

export const linkPageRuntimeCopy = (locale: string) => (locale.startsWith("ar") ? runtimeCopy.ar : runtimeCopy.en);

const titleClassName = `text-[calc(16px*var(--lp-heading-scale,1))] leading-[1.3] ${headingClassName}`;

const descriptionClassName = `mt-[4px] text-[calc(14px*var(--lp-body-scale,1))] leading-[1.3] opacity-85 ${bodyClassName}`;

const ListHeading = ({
	block,
	context,
	description,
	title,
}: {
	block: { id: string };
	context: RenderContext;
	description: string;
	title: string;
}) =>
	title || description || context.textElementProps ? (
		<div className='mb-[11px] w-full'>
			{(title || context.textElementProps) && (
				<h2
					{...context.textElementProps?.({
						blockId: block.id,
						content: title,
						field: "title",
						kind: "block",
						maxLength: linkPageLimits.label,
						multiline: false,
					})}
					className={titleClassName}
				>
					{title}
				</h2>
			)}
			{description && <p className={descriptionClassName}>{description}</p>}
		</div>
	) : null;

const sectionClassName = "w-full py-[22px]";

export const LinkPageVideoBlock = ({
	block,
	context,
}: {
	block: Extract<ResolvedLinkPageBlock, { kind: "video" }>;
	context: RenderContext;
}) => (
	<figure className='w-full'>
		<div className={`${radiusClassName} relative aspect-video w-full overflow-hidden bg-black`}>
			{context.preview ? (
				<>
					<img
						alt=''
						className='size-full object-cover'
						decoding='async'
						loading='lazy'
						src={`https://i.ytimg.com/vi/${block.videoId}/hqdefault.jpg`}
					/>
					<span
						aria-hidden='true'
						className='absolute inset-0 m-auto flex size-14 items-center justify-center rounded-full bg-white/90 text-black'
					>
						<svg className='ms-1 size-6' fill='currentColor' viewBox='0 0 24 24'>
							<path d='M8 5v14l11-7z' />
						</svg>
					</span>
				</>
			) : (
				<iframe
					allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
					allowFullScreen
					className='absolute inset-0 size-full border-0'
					loading='lazy'
					referrerPolicy='strict-origin-when-cross-origin'
					src={`https://www.youtube-nocookie.com/embed/${block.videoId}`}
					title={block.title || "YouTube"}
				/>
			)}
		</div>
		{(block.title || context.textElementProps) && (
			<figcaption
				{...context.textElementProps?.({
					blockId: block.id,
					content: block.title,
					field: "title",
					kind: "block",
					maxLength: linkPageLimits.videoTitle,
					multiline: false,
				})}
				className='mt-2 text-center text-sm font-medium'
			>
				{block.title}
			</figcaption>
		)}
	</figure>
);

const textBlockClassName = (context: RenderContext) =>
	context.studio ? "text-[calc(13.8px*var(--lp-body-scale,1))] leading-[1.3]" : "text-sm/6";

export const LinkPageTextBlock = ({
	block,
	context,
	standaloneSurface,
}: {
	block: Extract<ResolvedLinkPageBlock, { kind: "text" }>;
	context: RenderContext;
	standaloneSurface: boolean;
}) => (
	<div
		className={`${standaloneSurface ? `${surfaceClassName} ${radiusClassName} px-5 py-5` : ""} flex w-full flex-col gap-4`}
	>
		{block.format === "rich" && !context.textElementProps ? (
			<LinkPageRichText className={textBlockClassName(context)} text={block.text} />
		) : (
			<p
				{...context.textElementProps?.({
					blockId: block.id,
					content: block.text,
					field: "text",
					kind: "block",
					maxLength: linkPageLimits.text,
					multiline: true,
				})}
				className={`whitespace-pre-line ${textBlockClassName(context)}`}
			>
				{block.text}
			</p>
		)}
		{block.button && (
			<LinkSurface
				className={`${context.buttonClassName} inline-flex min-h-11 items-center justify-center px-5 py-2 text-sm font-semibold`}
				context={context}
				href={block.button.url}
				linkId={block.id}
			>
				<span
					{...context.textElementProps?.({
						blockId: block.id,
						content: block.button.label,
						field: "buttonLabel",
						kind: "block",
						maxLength: linkPageLimits.buttonLabel,
						multiline: false,
					})}
				>
					{block.button.label}
				</span>
			</LinkSurface>
		)}
	</div>
);

export const LinkPageHeaderBlock = ({
	block,
	context,
}: {
	block: Extract<ResolvedLinkPageBlock, { kind: "header" }>;
	context: RenderContext;
}) => (
	<h2
		{...context.textElementProps?.({
			blockId: block.id,
			content: block.text,
			field: "text",
			kind: "block",
			maxLength: linkPageLimits.label,
			multiline: false,
		})}
		className={
			context.studio
				? "w-full pt-[var(--lp-divider-above,6px)] pb-[var(--lp-divider-below,6px)] text-center text-[calc(var(--lp-divider-size,18px)*var(--lp-heading-scale,1))] leading-[1.3] [font-family:var(--website-font-brand)] [font-weight:var(--website-heading-weight)] after:mt-[var(--lp-divider-rule-gap,0px)] after:block after:[border-top:var(--lp-divider-rule,none)] after:content-['']"
				: "mt-3 w-full text-base font-semibold [font-family:var(--website-font-brand)]"
		}
	>
		{block.text}
	</h2>
);

export const LinkPageTabsBlock = ({ block, context }: { block: Block<"tabs">; context: RenderContext }) =>
	block.style === "menu" && !context.textElementProps ? null : (
		<ul className='flex w-full flex-wrap justify-center gap-[8px]'>
			{block.items.map((item, index) => (
				<li key={item.id}>
					<a
						{...anchorProps({ context, href: item.url })}
						className={`block rounded-full px-[17px] py-[6px] text-[14px] leading-[1.2] font-bold whitespace-nowrap text-[#1d1d28] shadow-[0_1px_3px_rgba(0,0,0,0.03),0_2px_8px_rgba(0,0,0,0.04)] ${index === 0 ? "bg-[rgba(255,255,255,0.85)]" : "bg-[rgba(255,255,255,0.4)]"} ${focusClassName}`}
					>
						{item.label}
					</a>
				</li>
			))}
		</ul>
	);

export const LinkPageEmbedBlock = ({ block, context }: { block: Block<"embed">; context: RenderContext }) => {
	if (!block.embed) {
		return null;
	}

	const { embed } = block;
	const style: CSSProperties = embed.height > 0 ? { height: `${embed.height}px` } : { aspectRatio: "16 / 9" };

	return (
		<figure className='w-full'>
			<div
				className='relative w-full overflow-hidden rounded-[var(--lp-button-radius,var(--website-radius))]'
				style={style}
			>
				{context.preview && embed.provider === "youtube" ? (
					<>
						<img
							alt=''
							className='absolute inset-0 size-full object-cover'
							loading='lazy'
							src={`https://i.ytimg.com/vi/${embed.src.split("/").at(-1)}/hqdefault.jpg`}
						/>
						<span
							aria-hidden='true'
							className='absolute inset-0 m-auto flex h-12 w-[68px] items-center justify-center rounded-[14px] bg-[#f00] text-white'
						>
							<svg className='ms-0.5 size-6' fill='currentColor' viewBox='0 0 24 24'>
								<path d='M8 5v14l11-7z' />
							</svg>
						</span>
					</>
				) : (
					<iframe
						allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'
						allowFullScreen
						className='absolute inset-0 size-full border-0'
						loading='lazy'
						referrerPolicy='strict-origin-when-cross-origin'
						src={embed.src}
						title={block.title || embed.provider}
					/>
				)}
			</div>
		</figure>
	);
};

const fieldClassName =
	"h-[46px] w-full border-2 border-current bg-transparent px-[11px] text-[14px] text-current placeholder:text-current/60 [border-radius:var(--lp-button-radius,0px)]";

export const LinkPageFormBlock = ({ block, context }: { block: Block<"form">; context: RenderContext }) => {
	const copy = linkPageRuntimeCopy(context.locale);
	const inline = block.fields.length === 1 && block.fields[0]?.type !== "textarea";

	const submit = (
		<button
			className={`flex h-[46px] items-center justify-center bg-[var(--lp-button-text)] text-[14px] font-semibold text-[var(--lp-button-fill)] [border-radius:var(--lp-button-radius,0px)] ${inline ? "w-[46px] shrink-0" : "mt-[17px] w-full px-[11px]"}`}
			disabled={context.preview}
			type='submit'
		>
			{inline ? <LinkPageActionIcon className='size-7' name='send' /> : block.submitLabel || copy.submit}
		</button>
	);

	return (
		<form
			action={block.action}
			className={`w-full bg-[var(--lp-button-fill)] px-[13.75px] text-[var(--lp-button-text)] [border-radius:var(--lp-button-radius,0px)] ${sectionClassName}`}
			method='post'
		>
			<ListHeading block={block} context={context} description={block.description} title={block.title} />
			<div className={inline ? "flex items-stretch" : "flex flex-col gap-[11px]"}>
				{block.fields.map((field) => (
					<label className='flex flex-1 flex-col gap-[6px]' key={field.id}>
						{!inline && <span className='text-[13px] font-semibold'>{field.label}</span>}
						{field.type === "textarea" ? (
							<textarea
								className={`${fieldClassName} h-[92px] py-[11px]`}
								name={field.id}
								placeholder={inline ? field.label : undefined}
								required={field.required}
							/>
						) : (
							<input
								className={fieldClassName}
								name={field.id}
								placeholder={inline ? field.label : undefined}
								required={field.required}
								type={field.type === "phone" ? "tel" : field.type}
							/>
						)}
					</label>
				))}
				{inline && submit}
			</div>
			{!inline && submit}
		</form>
	);
};

export const LinkPageMarqueeBlock = ({ block }: { block: Block<"marquee"> }) => {
	const text = `${block.text}${block.separator ? `  ${block.separator}  ` : "   "}`;

	const style: CSSProperties = block.colors
		? { backgroundColor: block.style === "ribbon" ? block.colors.ribbon : undefined, color: block.colors.text }
		: {};

	return (
		<div
			aria-label={block.text}
			className={`-mx-[16.5px] w-[calc(100%+33px)] overflow-hidden py-[8px] text-[22px] leading-[1.4] ${block.uppercase ? "uppercase" : ""} ${block.style === "ribbon" ? "-rotate-2 scale-105 shadow-[0_10px_30px_rgba(0,0,0,0.15)]" : ""} ${headingClassName}`}
			role='marquee'
			style={style}
		>
			<LinkPageMarqueeTrack className='' speed={block.speed}>
				<span className='whitespace-pre'>{text.repeat(6)}</span>
			</LinkPageMarqueeTrack>
		</div>
	);
};

export const LinkPageAnnouncementBlock = ({
	block,
	context,
}: {
	block: Block<"announcement">;
	context: RenderContext;
}) => {
	const style: CSSProperties = {
		backgroundColor: block.colors?.background ?? "var(--lp-button-fill)",
		color: block.colors?.text ?? "var(--lp-button-text)",
	};

	if (block.layout === "banner") {
		return (
			<LinkPageDismissible className='sticky top-0 z-30 w-full'>
				<div className='px-[38.5px] py-[8px] text-center text-[14px] leading-[1.4]' style={style}>
					<span className='me-[6px] font-semibold'>{block.title}</span>
					{block.description && <span className='me-[6px] opacity-85'>{block.description}</span>}
					{block.button && (
						<a {...anchorProps({ context, href: block.button.url })} className='font-semibold underline'>
							{block.button.label}
						</a>
					)}
				</div>
			</LinkPageDismissible>
		);
	}

	return (
		<LinkPageDismissible
			className={`${context.preview ? "sticky self-start" : "fixed start-[22px]"} bottom-[22px] z-30 ms-[22px] w-[calc(100%-44px)] max-w-[320px] rounded-[11px] shadow-[0_10px_30px_rgba(0,0,0,0.2)]`}
		>
			<div className='rounded-[11px] p-[16.5px] pe-[38px]' style={style}>
				<p className='mb-[3px] text-[15px] leading-[1.3] font-bold'>{block.title}</p>
				{block.description && (
					<p className='mb-[6px] text-[13px] leading-[1.4] opacity-90'>{block.description}</p>
				)}
				{block.button && (
					<a
						{...anchorProps({ context, href: block.button.url })}
						className='mt-[6px] inline-block rounded-full border border-current px-[11px] py-[6px] text-[13px] font-semibold'
					>
						{block.button.label}
					</a>
				)}
			</div>
		</LinkPageDismissible>
	);
};

export const LinkPageFaqBlock = ({ block, context }: { block: Block<"faq">; context: RenderContext }) => (
	<section className={sectionClassName}>
		<ListHeading block={block} context={context} description={block.description} title={block.title} />
		<div className='flex flex-col gap-[6px]'>
			{block.items.map((item, index) => (
				<details
					className='group/faq overflow-hidden rounded-[14px] border border-current'
					key={item.id}
					open={index === 0}
				>
					<summary className='flex cursor-pointer list-none items-center gap-[12px] px-[16px] py-[12px] text-[calc(14px*var(--lp-body-scale,1))] leading-[1.3] [&::-webkit-details-marker]:hidden'>
						<span className='flex-1'>{item.question}</span>
						<LinkPageActionIcon
							className='size-4 shrink-0 transition-transform group-open/faq:rotate-180 motion-reduce:transition-none'
							name='chevron'
						/>
					</summary>
					<p className='px-[16px] pb-[12px] text-[calc(13px*var(--lp-body-scale,1))] leading-[1.5] whitespace-pre-line'>
						{item.answer}
					</p>
				</details>
			))}
		</div>
	</section>
);

export const LinkPageTestimonialsBlock = ({
	block,
	context,
}: {
	block: Block<"testimonials">;
	context: RenderContext;
}) => (
	<section className={sectionClassName}>
		<ListHeading block={block} context={context} description={block.description} title={block.title} />
		<div className='flex flex-col gap-[11px]'>
			{block.items.map((item) => (
				<LinkSurface
					className='flex w-full gap-[11px] rounded-[var(--lp-button-radius,8px)] border border-current px-[16.5px] py-[13.75px] text-start opacity-90'
					context={context}
					href={item.url ?? ""}
					key={item.id}
					linkId={item.id}
				>
					<span className='flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-current/15 text-[14px] font-semibold'>
						{item.imageUrl ? (
							<img alt='' className='size-full object-cover' loading='lazy' src={item.imageUrl} />
						) : (
							item.name.slice(0, 1)
						)}
					</span>
					<span className='min-w-0 flex-1'>
						<span className='block text-[14px] leading-[1.3] font-semibold'>{item.name}</span>
						{item.company && (
							<span className='block text-[12px] leading-[1.3] opacity-60'>{item.company}</span>
						)}
						<span className='mt-[5.5px] block text-[13px] leading-[1.4] opacity-80'>“{item.quote}”</span>
					</span>
				</LinkSurface>
			))}
		</div>
	</section>
);

export const LinkPageCountdownBlock = ({ block, context }: { block: Block<"countdown">; context: RenderContext }) => (
	<section className={`${sectionClassName} flex flex-col`}>
		<ListHeading block={block} context={context} description={block.description} title={block.title} />
		<div className='rounded-[var(--lp-button-radius,10px)] border-2 border-dashed border-current px-[16.5px] py-[13.75px] text-center opacity-90'>
			<LinkPageCountdownClock
				endedMessage={block.endedMessage}
				endsAt={block.endsAt}
				labels={linkPageRuntimeCopy(context.locale)}
			/>
		</div>
	</section>
);
