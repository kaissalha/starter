import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";

import { blogPosts, db, organizations, websites } from "@starter/db";

const publishedWebsite = (websiteId: string) =>
	and(
		eq(websites.id, websiteId),
		isNotNull(websites.publishedVersionId),
		isNull(websites.suspendedAt),
		isNotNull(blogPosts.publishedDocument),
		isNotNull(blogPosts.publishedAt)
	);

export const listPublishedBlogPosts = async ({
	page = 1,
	pageSize = 12,
	websiteId,
}: {
	page?: number;
	pageSize?: number;
	websiteId: string;
}) => {
	const size = Math.max(1, Math.min(100, Math.floor(pageSize)));
	const currentPage = Math.max(1, Math.floor(page));
	const condition = publishedWebsite(websiteId);

	const [rows, totals] = await Promise.all([
		db
			.select({
				document: blogPosts.publishedDocument,
				id: blogPosts.id,
				publishedAt: blogPosts.publishedAt,
				slug: blogPosts.slug,
				updatedAt: blogPosts.publishedUpdatedAt,
			})
			.from(blogPosts)
			.innerJoin(websites, eq(websites.organizationId, blogPosts.organizationId))
			.where(condition)
			.orderBy(desc(blogPosts.publishedAt), desc(blogPosts.id))
			.limit(size)
			.offset((currentPage - 1) * size),
		db
			.select({ total: count() })
			.from(blogPosts)
			.innerJoin(websites, eq(websites.organizationId, blogPosts.organizationId))
			.where(condition),
	]);

	return {
		data: rows.flatMap(({ document, publishedAt, ...post }) =>
			document && publishedAt
				? [
						{
							...post,
							ar: {
								coverAlt: document.ar.coverAlt,
								excerpt: document.ar.excerpt,
								title: document.ar.title,
							},
							coverImage: document.coverImage,
							en: {
								coverAlt: document.en.coverAlt,
								excerpt: document.en.excerpt,
								title: document.en.title,
							},
							publishedAt,
							translations: Object.fromEntries(
								Object.entries(document.translations ?? {}).map(([locale, copy]) => [
									locale,
									{ coverAlt: copy.coverAlt, excerpt: copy.excerpt, title: copy.title },
								])
							),
							updatedAt: post.updatedAt ?? publishedAt,
						},
					]
				: []
		),
		page: currentPage,
		pageSize: size,
		total: totals[0]?.total ?? 0,
	};
};

export const getPublishedBlogPost = async ({ slug, websiteId }: { slug: string; websiteId: string }) => {
	const [post] = await db
		.select({
			authorName: organizations.name,
			document: blogPosts.publishedDocument,
			id: blogPosts.id,
			publishedAt: blogPosts.publishedAt,
			slug: blogPosts.slug,
			updatedAt: blogPosts.publishedUpdatedAt,
		})
		.from(blogPosts)
		.innerJoin(websites, eq(websites.organizationId, blogPosts.organizationId))
		.innerJoin(organizations, eq(organizations.id, blogPosts.organizationId))
		.where(and(publishedWebsite(websiteId), eq(blogPosts.slug, slug)))
		.limit(1);

	return post?.document && post.publishedAt
		? {
				...post,
				document: post.document,
				publishedAt: post.publishedAt,
				updatedAt: post.updatedAt ?? post.publishedAt,
			}
		: null;
};

export const listAllPublishedBlogPosts = async ({ websiteId }: { websiteId: string }) => {
	const posts = await db
		.select({
			document: blogPosts.publishedDocument,
			publishedAt: blogPosts.publishedAt,
			slug: blogPosts.slug,
			updatedAt: blogPosts.publishedUpdatedAt,
		})
		.from(blogPosts)
		.innerJoin(websites, eq(websites.organizationId, blogPosts.organizationId))
		.where(publishedWebsite(websiteId))
		.orderBy(desc(blogPosts.publishedAt), desc(blogPosts.id));

	return posts.flatMap(({ document, publishedAt, slug, updatedAt }) =>
		publishedAt
			? [
					{
						locales: ["en", "ar", ...Object.keys(document?.translations ?? {})],
						slug,
						updatedAt: updatedAt ?? publishedAt,
					},
				]
			: []
	);
};
