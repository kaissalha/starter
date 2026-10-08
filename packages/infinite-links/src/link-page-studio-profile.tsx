import type { CSSProperties, ReactNode } from "react";

import type { BrandLogo } from "@starter/infinite-brand";

import { linkPageLimits, type LinkPageDocument, type LinkPageStudioLayout } from "./contracts";
import { LinkPageVerifiedBadge } from "./link-page-icons";
import {
	linkPageStudioBodyClassName as bodyClassName,
	linkPageStudioHeadingClassName as headingClassName,
	type LinkPageRenderContext as RenderContext,
} from "./link-page-link-blocks";
import { getInitials, LinkPageLogo } from "./link-page-profile";
import { linkPageHeadshotScale, linkPageSheetFade, linkPageStudioAvatar } from "./link-page-studio-style";

const businessLeadClassName = "mt-[11px] text-[calc(32px*var(--lp-heading-scale,1))] leading-[1.1]";

const titleClassNames = {
	banner: "text-[calc(15px*var(--lp-heading-scale,1))] leading-[1.3]",
	business: businessLeadClassName,
	centered: "text-[calc(15px*var(--lp-heading-scale,1))] leading-[1.3]",
	headshot: "text-[calc(24px*var(--lp-heading-scale,1))] leading-[1.1]",
} satisfies Record<LinkPageStudioLayout, string>;

const StudioAvatar = ({
	document,
	layout,
	title,
}: {
	document: LinkPageDocument;
	layout: LinkPageStudioLayout;
	title: string;
}) => {
	const avatar = linkPageStudioAvatar({ appearance: document.appearance, layout });

	const style: CSSProperties & Record<`--${string}`, string> = {
		"--lp-avatar-ring": `${avatar.ring}px`,
		"--lp-avatar-ring-color": avatar.ringColor,
		"--lp-avatar-shadow": avatar.shadow,
		"--lp-avatar-size": `${avatar.size}px`,
	};

	return (
		<div
			className='relative mb-[calc(11px+var(--lp-avatar-ring))] size-[var(--lp-avatar-size)] shrink-0'
			data-links-profile-image=''
			style={style}
		>
			{avatar.ring > 0 && (
				<span
					aria-hidden='true'
					className='absolute -inset-[calc(var(--lp-avatar-ring)/2)] rounded-full bg-[var(--lp-avatar-ring-color)] shadow-[var(--lp-avatar-shadow)]'
				/>
			)}
			<span
				className={`relative flex size-full items-center justify-center overflow-hidden rounded-full bg-[var(--foreground-primary)] text-2xl font-semibold text-[var(--surface-canvas)] ${avatar.ring > 0 ? "" : "shadow-[var(--lp-avatar-shadow)]"}`}
			>
				{document.profile.imageUrl ? (
					<img
						alt=''
						className='absolute inset-0 size-full object-cover'
						height={220}
						loading='eager'
						src={document.profile.imageUrl}
						width={220}
					/>
				) : (
					<span aria-hidden='true'>{getInitials(title)}</span>
				)}
			</span>
		</div>
	);
};

const Fade = ({ className, color }: { className: string; color: string }) => (
	<div
		aria-hidden='true'
		className={`pointer-events-none absolute inset-x-0 z-[1] h-[100px] ${className}`}
		style={{ backgroundImage: linkPageSheetFade(color) }}
	/>
);

const StudioVisual = ({
	backdrop,
	fadeColor,
	imageUrl,
	layout,
}: {
	backdrop: ReactNode;
	fadeColor: string | null;
	imageUrl: string | null;
	layout: LinkPageStudioLayout;
}) => {
	if (layout === "banner") {
		return (
			<>
				<div
					className={`absolute inset-x-0 top-0 overflow-hidden ${fadeColor ? "h-[165px]" : "h-[125px]"}`}
					data-links-profile-banner=''
				>
					{backdrop}
				</div>
				{fadeColor && <Fade className='top-[65px]' color={fadeColor} />}
			</>
		);
	}

	if (layout !== "headshot") {
		return null;
	}

	return (
		<>
			<div
				aria-hidden='true'
				className={`absolute inset-x-0 top-0 overflow-hidden bg-[rgba(0,0,0,0.08)] ${fadeColor ? "h-[calc(280px*var(--lp-headshot-scale)+40px)]" : "h-[calc(280px*var(--lp-headshot-scale))]"}`}
				data-links-profile-headshot=''
			>
				{imageUrl && (
					<img
						alt=''
						className='absolute inset-0 size-full object-cover'
						height={560}
						loading='eager'
						src={imageUrl}
						width={780}
					/>
				)}
			</div>
			{fadeColor && <Fade className='top-[calc(280px*var(--lp-headshot-scale)-59px)]' color={fadeColor} />}
		</>
	);
};

const StudioText = ({
	bio,
	context,
	layout,
	logo,
	tagline,
	title,
	titleColor,
	verified,
}: {
	bio: string;
	context: RenderContext;
	layout: LinkPageStudioLayout;
	logo: BrandLogo | undefined;
	tagline: string;
	title: string;
	titleColor?: string;
	verified: boolean;
}) => {
	const color = titleColor ? { color: titleColor } : undefined;
	const editing = Boolean(context.textElementProps);
	const businessTagline = layout === "business" && Boolean(tagline || editing);

	return (
		<>
			<h1
				key={title}
				{...context.textElementProps?.({
					content: title,
					field: "title",
					kind: "profile",
					maxLength: linkPageLimits.title,
					multiline: false,
				})}
				className={`max-w-full break-words ${logo ? "sr-only" : ""} ${businessTagline ? "mt-[6px] text-[calc(14px*var(--lp-heading-scale,1))] leading-[1.3]" : titleClassNames[layout]} ${headingClassName}`}
				data-links-profile-title=''
				style={color}
			>
				{title}
				{verified && <LinkPageVerifiedBadge className='ms-[4px] inline-block size-[17px] align-[-0.2em]' />}
			</h1>
			{(tagline || editing) && (
				<p
					{...context.textElementProps?.({
						content: tagline,
						field: "tagline",
						kind: "profile",
						maxLength: linkPageLimits.tagline,
						multiline: false,
					})}
					className={
						businessTagline
							? `break-words ${businessLeadClassName} ${headingClassName}`
							: `mt-[6px] max-w-[300px] text-[calc(13px*var(--lp-body-scale,1))] leading-[1.3] opacity-75 ${bodyClassName}`
					}
					data-links-profile-tagline=''
					style={color}
				>
					{tagline}
				</p>
			)}
			{(bio || editing) && (
				<p
					{...context.textElementProps?.({
						content: bio,
						field: "bio",
						kind: "profile",
						maxLength: linkPageLimits.bio,
						multiline: true,
					})}
					className={`whitespace-pre-line text-[calc(13.8px*var(--lp-body-scale,1))] leading-[1.3] ${layout === "business" ? "mt-[11px]" : "mt-[33px] max-w-[300px]"} ${bodyClassName}`}
					style={color}
				>
					{bio}
				</p>
			)}
		</>
	);
};

const paddings = {
	banner: "pt-[158px]",
	business: "pt-[33px]",
	centered: "pt-[33px]",
	headshot: "pt-[calc(280px*var(--lp-headshot-scale)+33px)]",
} satisfies Record<LinkPageStudioLayout, string>;

const resolveHeaderClassName = ({ fadeColor, layout }: { fadeColor: string | null; layout: LinkPageStudioLayout }) => {
	if (layout === "business") {
		return `items-start text-start ${fadeColor ? "pb-[73px]" : "pb-[33px]"}`;
	}

	return `mb-[33px] items-center text-center ${layout === "banner" ? "mt-[var(--lp-banner-overlap)]" : ""}`;
};

export const LinkPageStudioProfile = ({
	backdrop,
	bio,
	children,
	context,
	document,
	layout,
	logo,
	pageColor,
	tagline,
	title,
}: {
	backdrop: ReactNode;
	bio: string;
	children: ReactNode;
	context: RenderContext;
	document: LinkPageDocument;
	layout: LinkPageStudioLayout;
	logo: BrandLogo | undefined;
	pageColor: string;
	tagline: string;
	title: string;
}) => {
	const { appearance, profile } = document;
	const fadeColor = layout !== "centered" && appearance.banner?.fade ? pageColor : null;
	const avatarSize = linkPageStudioAvatar({ appearance, layout }).size;
	const business = layout === "business";

	const style: CSSProperties & Record<`--${string}`, string | number> = {
		"--lp-banner-overlap": `${-(33 + avatarSize / 2)}px`,
		"--lp-headshot-scale": linkPageHeadshotScale(appearance),
	};

	return (
		<div className='relative w-full' data-links-profile-layout={layout} style={style}>
			<StudioVisual backdrop={backdrop} fadeColor={fadeColor} imageUrl={profile.imageUrl} layout={layout} />
			<div
				className={`relative z-[2] mx-auto w-full max-w-[530px] px-[16.5px] @[600px]:px-[33px] ${paddings[layout]}`}
			>
				<div className={`relative flex flex-col ${resolveHeaderClassName({ fadeColor, layout })}`}>
					{business && (
						<div
							className='absolute -inset-x-[16.5px] -top-[33px] @[600px]:-inset-x-[33px] bottom-0 -z-10 overflow-hidden'
							data-links-profile-banner=''
						>
							{backdrop}
							{fadeColor && <Fade className='bottom-0' color={fadeColor} />}
						</div>
					)}
					{logo && (
						<div className='mb-[11px]'>
							<LinkPageLogo logo={logo} title={title} />
						</div>
					)}
					{!logo && layout !== "headshot" && (
						<StudioAvatar document={document} layout={layout} title={title} />
					)}
					<StudioText
						bio={bio}
						context={context}
						layout={layout}
						logo={logo}
						tagline={tagline}
						title={title}
						titleColor={appearance.titleColor ?? undefined}
						verified={profile.verified === true}
					/>
					{!business && children}
				</div>
				{business && <div className='mb-[33px] flex flex-col items-center text-center'>{children}</div>}
			</div>
		</div>
	);
};
