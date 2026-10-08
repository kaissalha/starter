import { Suspense } from "react";

import { notFound } from "next/navigation";
import { connection } from "next/server";

import { z } from "zod";

import { getTranslations } from "@/lib/i18n";
import { serverApiClient } from "@/lib/server/api-client";
import { getQueryClient, prefetch } from "@/lib/server/query-client";
import { HydrateClient } from "@/lib/server/react-query";
import { Skeleton } from "@starter/ui/components/skeleton";
import "@starter/infinite-website/styles.css";
import "@starter/infinite-brand/fonts.css";

import { BlogPostPage } from "../blog-post-page";

export const instant = false;

export const generateMetadata = async () => ({ title: (await getTranslations("blog"))("editPost") });

const BlogPostRouteContent = async ({ params }: { params: Promise<{ postId: string }> }) => {
	await connection();
	const { postId } = await params;

	if (!z.uuid().safeParse(postId).success) {
		notFound();
	}

	prefetch(getQueryClient().query(serverApiClient.blogPosts.get.queryOptions({ input: { postId } })));
	prefetch(getQueryClient().query(serverApiClient.websites.get.queryOptions()));

	return (
		<HydrateClient>
			<BlogPostPage postId={postId} />
		</HydrateClient>
	);
};

export default function Page(props: { params: Promise<{ postId: string }> }) {
	return (
		<Suspense
			fallback={
				<div className='mx-auto w-full max-w-3xl space-y-6 p-6'>
					<Skeleton className='h-12 w-3/4' />
					<Skeleton className='aspect-video w-full' />
					<Skeleton className='h-32 w-full' />
				</div>
			}
		>
			<BlogPostRouteContent {...props} />
		</Suspense>
	);
}
