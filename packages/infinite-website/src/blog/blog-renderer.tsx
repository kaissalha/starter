import type { ReactNode } from "react";

import { renderJSONContentToReactElement } from "@tiptap/static-renderer/json/react";

import { getDirection } from "@starter/utils";

import type { Iso6391LanguageCode } from "../language-codes";
import type { SiteLinkComponent } from "../primitives/shared";
import { getBlogLocaleContent } from "./blog-contracts";
import type { BlogNode, BlogBody, BlogPostDocument, BlogPostSummary } from "./blog-contracts";

type BlogMark = NonNullable<Extract<BlogNode, { type: "text" }>["marks"]>[number];

const renderBlogNode = ({ children, node }: { children?: ReactNode; node: BlogNode | BlogBody }): ReactNode => {
	switch (node.type) {
		case "doc":
			return <>{children}</>;
		case "text":
			return node.text;
		case "hardBreak":
			return <br />;
		case "image":
			return (
				<img
					alt={node.attrs.alt ?? ""}
					className='my-8 h-auto max-w-full rounded-[var(--website-radius)]'
					height={node.attrs.height ?? undefined}
					loading='lazy'
					src={node.attrs.src}
					title={node.attrs.title ?? undefined}
					width={node.attrs.width ?? undefined}
				/>
			);
		case "paragraph":
			return <p className='my-4 leading-relaxed'>{children}</p>;
		case "heading":
			return node.attrs.level === 2 ? (
				<h2 className='mt-10 mb-4 font-[family-name:var(--website-font-brand)] text-3xl font-semibold'>
					{children}
				</h2>
			) : (
				<h3 className='mt-8 mb-3 font-[family-name:var(--website-font-brand)] text-2xl font-semibold'>
					{children}
				</h3>
			);
		case "blockquote":
			return <blockquote className='my-6 border-s-2 ps-6 italic'>{children}</blockquote>;
		case "bulletList":
			return <ul className='my-4 list-disc ps-6'>{children}</ul>;
		case "orderedList":
			return (
				<ol className='my-4 list-decimal ps-6' start={node.attrs?.start}>
					{children}
				</ol>
			);
		case "listItem":
			return <li className='my-1'>{children}</li>;
	}
};

const renderBlogBody = renderJSONContentToReactElement<BlogMark, BlogNode | BlogBody>({
	markMapping: {
		bold: ({ children }) => <strong>{children}</strong>,
		italic: ({ children }) => <em>{children}</em>,
		link: ({ children, mark }) =>
			mark.type === "link" ? (
				<a
					className='underline underline-offset-4'
					href={mark.attrs.href}
					rel='noopener noreferrer'
					target={mark.attrs.target ?? undefined}
				>
					{children}
				</a>
			) : (
				children
			),
	},
	nodeMapping: {
		blockquote: renderBlogNode,
		bulletList: renderBlogNode,
		doc: renderBlogNode,
		hardBreak: renderBlogNode,
		heading: renderBlogNode,
		image: renderBlogNode,
		listItem: renderBlogNode,
		orderedList: renderBlogNode,
		paragraph: renderBlogNode,
		text: renderBlogNode,
	},
});

export const BlogPostGrid = ({
	basePath = "",
	linkComponent: Link = "a",
	locale,
	posts,
}: {
	basePath?: string;
	linkComponent?: SiteLinkComponent;
	locale: string;
	posts: Array<BlogPostSummary>;
}) => (
	<div className='@container'>
		<div className='grid grid-cols-1 gap-8 @lg:grid-cols-2 @4xl:grid-cols-3'>
			{posts.map((post) => (
				<article key={post.id}>
					<Link
						className='group block rounded-[var(--website-radius)] focus-visible:outline-2 focus-visible:outline-offset-4'
						href={`${basePath}/blog/${post.slug}`}
					>
						{post.coverImage ? (
							<img
								alt={post.coverAlt}
								className='aspect-[4/3] w-full rounded-[var(--website-radius)] object-cover'
								loading='lazy'
								src={post.coverImage.src}
							/>
						) : (
							<div className='aspect-[4/3] rounded-[var(--website-radius)] bg-current/5' />
						)}
						<h2 className='mt-4 font-[family-name:var(--website-font-brand)] text-xl font-semibold group-hover:underline'>
							{post.title}
						</h2>
					</Link>
					<time className='mt-2 block text-sm opacity-60' dateTime={post.publishedAt}>
						{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
							new Date(post.publishedAt)
						)}
					</time>
					{post.excerpt && <p className='mt-3 line-clamp-3 leading-relaxed opacity-80'>{post.excerpt}</p>}
				</article>
			))}
		</div>
	</div>
);

export const BlogArticle = ({
	authorName,
	bodyContent,
	coverContent,
	document,
	fallbackLocale,
	locale,
	publishedAt,
	titleContent,
}: {
	authorName?: string;
	bodyContent?: ReactNode;
	coverContent?: ReactNode;
	document: BlogPostDocument;
	fallbackLocale?: Iso6391LanguageCode;
	locale: Iso6391LanguageCode;
	publishedAt?: string;
	titleContent?: ReactNode;
}) => {
	const copy = getBlogLocaleContent({ document, fallbackLocale, locale });

	return (
		<article
			className='mx-auto max-w-3xl px-6 py-12 font-[family-name:var(--website-font-body)]'
			dir={getDirection(locale)}
			lang={locale}
		>
			<h1 className='font-[family-name:var(--website-font-brand)] text-4xl leading-tight font-semibold text-balance md:text-5xl'>
				{titleContent ?? copy.title}
			</h1>
			{(authorName || publishedAt) && (
				<p className='my-5 flex flex-wrap gap-3 text-sm opacity-60'>
					{authorName && <span>{authorName}</span>}
					{publishedAt && (
						<time dateTime={publishedAt}>
							{new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
								new Date(publishedAt)
							)}
						</time>
					)}
				</p>
			)}
			{coverContent ??
				(document.coverImage && (
					<img
						alt={copy.coverAlt}
						className='my-8 aspect-[16/9] w-full rounded-[var(--website-radius)] object-cover'
						fetchPriority='high'
						src={document.coverImage.src}
					/>
				))}
			<div className='text-lg'>{bodyContent ?? renderBlogBody({ content: copy.body })}</div>
		</article>
	);
};
