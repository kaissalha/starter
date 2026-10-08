import type { CSSProperties } from "react";

import type { TypographyAppearance } from "../document/structure-schema";
import type { SiteLinkComponent } from "../primitives/shared";
import { typographyAppearanceStyle } from "../primitives/typography";
import type { BlogPostSummary } from "./blog-contracts";

export const blogLayoutPatterns = ["blog-featured", "blog-feed", "blog-list", "blog-portrait-grid"];

const postLimits = {
	"blog-featured": 3,
	"blog-feed": 9,
	"blog-list": 4,
	"blog-portrait-grid": 3,
} satisfies Record<string, number>;

const sp = (units: number) => `calc(var(--iw-spacing)*${units})`;

const type = (appearance: TypographyAppearance): CSSProperties => typographyAppearanceStyle({ appearance });

type PostProps = { basePath: string; linkComponent: SiteLinkComponent; locale: string; post: BlogPostSummary };

const formatDate = ({ locale, post }: { locale: string; post: BlogPostSummary }) =>
	new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(post.publishedAt));

const href = ({ basePath, post }: { basePath: string; post: BlogPostSummary }) => `${basePath}/blog/${post.slug}`;

const PostCard = ({ basePath, linkComponent: Link, locale, post }: PostProps) => (
	<article className='h-full'>
		<Link
			className='group flex h-full flex-col overflow-hidden rounded-[var(--website-radius)] bg-foreground-primary/5 text-foreground-primary no-underline'
			href={href({ basePath, post })}
		>
			{post.coverImage && (
				<img
					alt={post.coverAlt}
					className='aspect-[16/10] w-full object-cover transition-transform duration-300 group-hover:scale-105'
					loading='lazy'
					src={post.coverImage.src}
				/>
			)}
			<div className='flex flex-1 flex-col' style={{ padding: sp(5) }}>
				<h3 className='line-clamp-2' style={type("heading-sm")}>
					{post.title}
				</h3>
				{post.excerpt && (
					<p className='mt-2 line-clamp-3 text-foreground-muted' style={type("body-sm")}>
						{post.excerpt}
					</p>
				)}
				<time
					className='mt-auto pt-6 text-foreground-muted'
					dateTime={post.publishedAt}
					style={type("label-sm")}
				>
					{formatDate({ locale, post })}
				</time>
			</div>
		</Link>
	</article>
);

const PostRow = ({ basePath, linkComponent: Link, post }: PostProps) => (
	<Link
		className='flex items-start border-t border-[var(--border-subtle)] text-foreground-primary no-underline hover:opacity-70 @min-[40rem]:px-4'
		href={href({ basePath, post })}
		style={{ columnGap: sp(6), padding: `${sp(8)} ${sp(6)}` }}
	>
		<span className='w-8 shrink-0 text-foreground-muted' style={type("body-md")}>
			{String(new Date(post.publishedAt).getUTCFullYear() % 100).padStart(2, "0")}
		</span>
		<div className='flex min-w-0 flex-1 flex-col gap-2'>
			<h3 className='italic' style={type("heading-sm")}>
				{post.title}
			</h3>
			{post.excerpt && (
				<p className='line-clamp-2 text-foreground-muted' style={type("body-sm")}>
					{post.excerpt}
				</p>
			)}
		</div>
	</Link>
);

const PortraitCard = ({ basePath, index, linkComponent: Link, locale, post }: PostProps & { index: number }) => (
	<Link
		className={`group flex min-w-0 flex-col text-foreground-primary no-underline ${index === 2 ? "@min-[40rem]:col-span-2 @min-[80.01rem]:col-span-1" : ""}`}
		href={href({ basePath, post })}
	>
		{post.coverImage && (
			<div className='aspect-square w-full overflow-hidden opacity-80 transition-opacity group-hover:opacity-100 @min-[40rem]:aspect-[3/4] @min-[40rem]:max-h-[calc(var(--iw-spacing)*86)]'>
				<img alt={post.coverAlt} className='size-full object-cover' loading='lazy' src={post.coverImage.src} />
			</div>
		)}
		<time
			className='pt-6 text-foreground-muted @min-[80.01rem]:pt-4'
			dateTime={post.publishedAt}
			style={type("label-sm")}
		>
			{formatDate({ locale, post })}
		</time>
		<h3 className='pt-4 @min-[80.01rem]:pt-3' style={type("body-md")}>
			{post.title}
		</h3>
	</Link>
);

export const BlogLayoutPosts = ({
	basePath = "",
	empty,
	linkComponent,
	locale,
	pattern,
	posts,
}: {
	basePath?: string;
	empty: string;
	linkComponent: SiteLinkComponent;
	locale: string;
	pattern: string;
	posts: Array<BlogPostSummary>;
}) => {
	const visible = posts.slice(0, Object.entries(postLimits).find(([key]) => key === pattern)?.[1] ?? 3);
	const props = { basePath, linkComponent, locale };
	const isList = pattern === "blog-list";
	const isPortrait = pattern === "blog-portrait-grid";

	const emptyBox = (
		<p className='rounded-[var(--website-radius)] border border-dashed border-[var(--border-subtle)] p-10 text-center text-foreground-muted'>
			{empty}
		</p>
	);

	const list = (
		<div className='border-b border-[var(--border-subtle)]'>
			{visible.map((post) => (
				<PostRow key={post.id} {...props} post={post} />
			))}
		</div>
	);

	const grid = (
		<div
			className='grid grid-cols-1 @min-[40rem]:grid-cols-2 @min-[80.01rem]:grid-cols-3'
			style={{ gap: sp(isPortrait ? 3 : 4) }}
		>
			{visible.map((post, index) =>
				isPortrait ? (
					<PortraitCard key={post.id} {...props} index={index} post={post} />
				) : (
					<PostCard key={post.id} {...props} post={post} />
				)
			)}
		</div>
	);

	const populated = isList ? list : grid;
	const body = visible.length === 0 ? emptyBox : populated;

	return (
		<div className='bg-[var(--surface-canvas)] font-[family-name:var(--website-font-body)]'>
			<div
				className={
					isList
						? "mx-auto w-full max-w-[96rem] px-6 pb-[calc(var(--iw-spacing)*20)] @min-[40rem]:pb-[calc(var(--iw-spacing)*24)]"
						: "mx-auto w-full max-w-[96rem] px-6 pb-[calc(var(--iw-spacing)*12)] @min-[40rem]:pb-[calc(var(--iw-spacing)*16)]"
				}
			>
				{body}
			</div>
		</div>
	);
};
