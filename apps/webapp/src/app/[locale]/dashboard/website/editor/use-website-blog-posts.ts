"use client";

import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { BlogPostSummary, SiteDocument } from "@starter/infinite-website";

export const useWebsiteBlogPosts = ({ document, locale }: { document: SiteDocument; locale: string }) => {
	const enabled =
		document.structure.layout.header.length > 0 ||
		document.structure.pages.some((page) =>
			page.sections.some((section) => section.source?.pattern.startsWith("blog-latest-"))
		);

	const query = useQuery({
		...apiClient.blogPosts.list.queryOptions({ input: { pageSize: 6, status: "published" } }),
		enabled,
	});

	return useMemo(
		() =>
			query.data?.data.flatMap((post): Array<BlogPostSummary> => {
				if (!post.publishedDocument || !post.publishedAt) {
					return [];
				}

				const copy = post.publishedDocument[locale === "ar" ? "ar" : "en"];

				return [
					{
						coverAlt: copy.coverAlt,
						coverImage: post.publishedDocument.coverImage,
						excerpt: copy.excerpt,
						id: post.id,
						publishedAt: post.publishedAt,
						slug: post.slug,
						title: copy.title,
					},
				];
			}) ?? [],
		[query.data, locale]
	);
};
