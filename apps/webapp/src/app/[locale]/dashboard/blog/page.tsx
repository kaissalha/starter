import { Suspense } from "react";

import { connection } from "next/server";

import { createLoader, type SearchParams } from "nuqs/server";

import { getTranslations } from "@/lib/i18n";
import { serverApiClient } from "@/lib/server/api-client";
import { getQueryClient, prefetch } from "@/lib/server/query-client";
import { HydrateClient } from "@/lib/server/react-query";
import { Skeleton } from "@starter/ui/components/skeleton";

import { BlogPage } from "./blog-page";
import { blogSearchParams } from "./blog-search-params";

export const instant = false;

export const generateMetadata = async () => ({ title: (await getTranslations("blog"))("title") });

const loadBlogSearchParams = createLoader(blogSearchParams);

const BlogRouteContent = async ({ searchParams }: { searchParams: Promise<SearchParams> }) => {
	await connection();
	const params = await loadBlogSearchParams(searchParams);
	prefetch(
		getQueryClient().query(
			serverApiClient.blogPosts.list.queryOptions({
				input: { page: Math.max(1, params.page), search: params.q, status: params.status },
			})
		)
	);

	return (
		<HydrateClient>
			<BlogPage />
		</HydrateClient>
	);
};

export default function Page(props: { searchParams: Promise<SearchParams> }) {
	return (
		<Suspense
			fallback={
				<div className='space-y-6 p-5'>
					<Skeleton className='h-10 w-full' />
					<div className='grid gap-6 sm:grid-cols-2 xl:grid-cols-4'>
						<Skeleton className='aspect-[4/3] w-full' corners='rounded' />
						<Skeleton className='aspect-[4/3] w-full' corners='rounded' />
						<Skeleton className='aspect-[4/3] w-full' corners='rounded' />
						<Skeleton className='aspect-[4/3] w-full' corners='rounded' />
					</div>
				</div>
			}
		>
			<BlogRouteContent {...props} />
		</Suspense>
	);
}
