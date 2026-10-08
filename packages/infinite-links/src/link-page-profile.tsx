import type { BrandLogo } from "@starter/infinite-brand";

import { linkPageLimits, type LinkPageBanner, type LinkPageDocument, type LinkPageProfile } from "./contracts";
import { LinkPageVerifiedBadge } from "./link-page-icons";
import { type LinkPageRenderContext as RenderContext } from "./link-page-link-blocks";
import { linkPageWallpaperStyle } from "./link-page-wallpaper";

export const getInitials = (title: string) =>
	title
		.split(/\s+/u)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0])
		.join("")
		.toLocaleUpperCase();

export const LinkPageLogo = ({ logo, title }: { logo: BrandLogo; title: string }) => (
	<img
		alt={title}
		className='block h-[calc(var(--lp-logo-scale)*4rem)] w-auto max-w-full object-contain'
		data-links-profile-logo=''
		loading='eager'
		src={logo.src}
		style={{ "--lp-logo-scale": logo.scale }}
	/>
);

const avatarClassName =
	"size-24 rounded-full border-4 border-[var(--lp-header-background,var(--surface-canvas))] shadow-lg";

const profileImageClasses = {
	banner: avatarClassName,
	"bold-01": "aspect-[4/5] w-full",
	"bold-02": "aspect-[3/4] w-full rounded-t-[50%]",
	"bold-03": "aspect-square w-full",
	"bold-04": "aspect-[4/5] w-[68%] -rotate-2",
	business: avatarClassName,
	centered: avatarClassName,
	classic: avatarClassName,
	"creative-01":
		"aspect-[4/5] w-[42%] border-[8px] border-[color-mix(in_srgb,var(--foreground-primary)_10%,var(--surface-canvas))] border-b-[24px]",
	"creative-02": "aspect-[3/4] w-[68%] rounded-b-sm",
	"creative-03": "aspect-square w-[88%] rounded-full",
	"creative-04": "aspect-[6/5] w-[62%] rounded-[22%]",
	headshot: avatarClassName,
	hero: avatarClassName,
	"minimal-01": avatarClassName,
	"minimal-02": "aspect-square w-[56%] rounded-full",
	"minimal-03": "aspect-square w-[38%] -rotate-15",
	"minimal-04": "size-20 rounded-full",
} satisfies Record<LinkPageProfile["layout"], string>;

const profileContentClasses = {
	banner: "gap-5",
	"bold-01": "gap-4 [&_[data-links-profile-title]]:order-first",
	"bold-02": "gap-7",
	"bold-03":
		"gap-0 [&_[data-links-profile-title]]:order-first [&_[data-links-profile-title]]:w-full [&_[data-links-profile-title]]:px-6 [&_[data-links-profile-title]]:py-[24%] [&_[data-links-profile-title]]:text-start",
	"bold-04": "gap-6 py-[46%]",
	business: "gap-5",
	centered: "gap-5",
	classic: "gap-5",
	"creative-01": "gap-8 py-8",
	"creative-02": "gap-8 [&_[data-links-profile-title]]:order-first",
	"creative-03": "gap-12",
	"creative-04": "gap-8 [&_[data-links-profile-title]]:order-first",
	headshot: "gap-5",
	hero: "gap-5",
	"minimal-01": "gap-5",
	"minimal-02": "gap-8 [&_[data-links-profile-title]]:order-first [&_[data-links-profile-title]]:uppercase",
	"minimal-03": "gap-9 [&_[data-links-profile-title]]:order-first",
	"minimal-04": "items-start! gap-4 border-b border-current/20 pb-8 text-start!",
} satisfies Record<LinkPageProfile["layout"], string>;

const ProfileImage = ({
	className,
	profile,
	title,
}: {
	className: string;
	profile: LinkPageProfile;
	title: string;
}) => (
	<span
		className={`${className} relative flex shrink-0 items-center justify-center overflow-hidden bg-[var(--foreground-primary)] text-3xl font-semibold text-[var(--surface-canvas)] [font-family:var(--website-font-brand)]`}
		data-links-profile-image=''
	>
		{profile.imageUrl ? (
			<img
				alt=''
				className='absolute inset-0 size-full object-cover'
				height={640}
				loading='eager'
				src={profile.imageUrl}
				width={640}
			/>
		) : (
			<span aria-hidden='true'>{getInitials(title)}</span>
		)}
	</span>
);

const ProfilePortrait = ({
	banner,
	profile,
	title,
}: {
	banner: LinkPageBanner | null | undefined;
	profile: LinkPageProfile;
	title: string;
}) => {
	const className = profileImageClasses[profile.layout];

	if (profile.layout === "creative-02") {
		return (
			<div className='relative flex w-full justify-center py-4'>
				<span
					aria-hidden='true'
					className='absolute inset-x-[20%] inset-y-5 rotate-12 border border-current/25 bg-[var(--surface-featured)]'
				/>
				<span
					aria-hidden='true'
					className='absolute inset-x-[17%] inset-y-5 -rotate-12 border border-current/25 bg-[var(--surface-featured)]'
				/>
				<div className='relative w-[68%] overflow-hidden rounded-sm shadow-[0_12px_32px_rgb(0_0_0/0.25)]'>
					<div aria-hidden='true' className='flex h-4 items-center gap-1 bg-neutral-800 px-2'>
						<span className='size-1.5 rounded-full bg-white/40' />
						<span className='size-1.5 rounded-full bg-white/40' />
						<span className='size-1.5 rounded-full bg-white/40' />
					</div>
					<ProfileImage className='aspect-[3/4] w-full' profile={profile} title={title} />
				</div>
			</div>
		);
	}

	if (profile.layout === "creative-01") {
		return (
			<div className='relative flex w-full justify-center py-4'>
				<div
					aria-hidden='true'
					className='absolute inset-0 flex -translate-x-[59%] items-center justify-center'
				>
					<ProfileImage className={className} profile={profile} title={title} />
				</div>
				<ProfileImage className={className} profile={profile} title={title} />
				<div aria-hidden='true' className='absolute inset-0 flex translate-x-[59%] items-center justify-center'>
					<ProfileImage className={className} profile={profile} title={title} />
				</div>
			</div>
		);
	}

	if (profile.layout === "minimal-03" && banner) {
		return (
			<div className='relative flex w-full justify-center py-4'>
				<span
					aria-hidden='true'
					className='absolute inset-y-4 start-[45%] aspect-square w-[38%] rotate-12'
					style={linkPageWallpaperStyle({ wallpaper: banner })}
				/>
				<ProfileImage className={`${className} -translate-x-[15%]`} profile={profile} title={title} />
			</div>
		);
	}

	return <ProfileImage className={className} profile={profile} title={title} />;
};

export const LinkPageProfileHeader = ({
	bio,
	context,
	document,
	logo,
	title,
}: {
	bio: string;
	context: RenderContext;
	document: LinkPageDocument;
	logo: BrandLogo | undefined;
	title: string;
}) => {
	const { appearance, profile } = document;
	const repeated = profile.layout === "bold-04";
	const marquee = profile.layout === "bold-01";

	const titleSizes =
		profile.layout === "classic" || profile.layout === "hero"
			? { large: "text-4xl sm:text-5xl", small: "text-2xl sm:text-3xl" }
			: { large: "text-[clamp(2rem,10cqw,3.5rem)]", small: "text-[clamp(1.5rem,7cqw,2.5rem)]" };

	const titleSize = titleSizes[profile.titleSize];

	const titleProps = context.textElementProps?.({
		content: title,
		field: "title",
		kind: "profile",
		maxLength: linkPageLimits.title,
		multiline: false,
	});

	const banner = ["minimal-01", "minimal-02", "minimal-04"].includes(profile.layout) ? appearance.banner : null;

	const embeddedDescription = ["minimal-02", "creative-04", "bold-03"].includes(profile.layout);

	const description = (bio || context.textElementProps) && (
		<p
			{...context.textElementProps?.({
				content: bio,
				field: "bio",
				kind: "profile",
				maxLength: linkPageLimits.bio,
				multiline: true,
			})}
			className='relative mt-3 max-w-md text-pretty text-sm/6 text-[var(--foreground-muted)]'
		>
			{bio}
		</p>
	);

	return (
		<>
			{banner && (
				<div
					aria-hidden='true'
					className='-mx-5 -mt-6 mb-[-3rem] h-[32cqw] max-h-48 w-[calc(100%+2.5rem)] max-w-none sm:-mx-8 sm:w-[calc(100%+4rem)]'
					style={linkPageWallpaperStyle({ wallpaper: banner })}
				/>
			)}
			<div
				className={`relative flex min-w-0 w-full flex-col ${profileContentClasses[profile.layout]} ${context.centered ? "items-center text-center" : "items-start text-start"}`}
				data-links-profile-design={profile.layout}
			>
				{repeated && (
					<div
						aria-hidden='true'
						className='pointer-events-none absolute inset-x-[-8%] top-[1em] bottom-0 overflow-hidden break-all text-center text-[clamp(3rem,20cqw,6rem)] leading-[0.95] uppercase [font-family:var(--website-font-brand)]'
						style={appearance.titleColor ? { color: appearance.titleColor } : undefined}
					>
						{Array.from({ length: 12 }, () => title).join(" ")}
					</div>
				)}
				{logo ? (
					<LinkPageLogo logo={logo} title={title} />
				) : (
					<ProfilePortrait banner={appearance.banner} profile={profile} title={title} />
				)}
				<div
					className={`${repeated ? "absolute inset-x-0 top-0 z-10 overflow-hidden text-[clamp(3rem,20cqw,6rem)] uppercase" : "relative max-w-full"} ${marquee ? "flex w-full gap-3 overflow-hidden border-y border-current py-1 whitespace-nowrap" : ""}`}
					data-links-profile-title=''
				>
					{profile.layout === "minimal-02" && description}
					<h1
						key={title}
						{...titleProps}
						className={`${repeated ? "whitespace-nowrap text-[inherit] leading-[0.95]" : titleSize} ${marquee ? "shrink-0" : "text-balance break-words"} font-semibold tracking-tight [font-family:var(--website-font-brand)] [font-weight:var(--website-heading-weight)] ${logo ? "sr-only" : ""}`}
						style={appearance.titleColor ? { color: appearance.titleColor } : undefined}
					>
						{title}
						{profile.verified && (
							<LinkPageVerifiedBadge className='ms-[4px] inline-block size-[0.8em] align-[-0.1em]' />
						)}
					</h1>
					{embeddedDescription && profile.layout !== "minimal-02" && description}
					{marquee && (
						<span
							aria-hidden='true'
							className={`${titleSize} shrink-0 [font-family:var(--website-font-brand)] [font-weight:var(--website-heading-weight)]`}
							style={appearance.titleColor ? { color: appearance.titleColor } : undefined}
						>
							{title} {title}
						</span>
					)}
				</div>
			</div>
			{!embeddedDescription && description}
		</>
	);
};
