"use client";

import { useState, type ReactElement } from "react";

import Image from "next/image";

import { Add01Icon, FilterMailIcon, News01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { SearchableHeader } from "@/app/[locale]/dashboard/components/layout/header/searchable-header";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Link, useRouter } from "@/i18n/navigation";
import { apiClient, client } from "@/lib/api-client";
import { createEmptyBlogPostDocument } from "@starter/infinite-website";
import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
} from "@starter/ui/components/dropdown-menu";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@starter/ui/components/empty";
import { Frame, FramePanel } from "@starter/ui/components/frame";
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "@starter/ui/components/select";
import { Skeleton } from "@starter/ui/components/skeleton";
import { toast } from "@starter/ui/components/toaster";
import { cn } from "@starter/ui/lib/utils";

import { BlogGenerationDialog } from "./blog-generation-dialog";
import { blogSearchParams, blogStatuses } from "./blog-search-params";
import type { BlogEditorPost } from "./use-blog-editor-controller";

const getPostStatus = (post: BlogEditorPost) => {
	if (post.generationStatus === "writing" || post.generationStatus === "failed") {
		return post.generationStatus;
	}

	if (!post.publishedDocument) {
		return "draft";
	}

	return post.revision === post.publishedRevision ? "published" : "unpublishedChanges";
};

const statusVariants = {
	draft: "default",
	failed: "critical",
	published: "optimal",
	unpublishedChanges: "suboptimal",
	writing: "default",
} as const;

const BlogPostCover = ({ locale, post }: { locale: "en" | "ar"; post: BlogEditorPost }) => {
	if (post.generationStatus !== "writing" && post.document.coverImage) {
		return (
			<Image
				alt={post.document[locale].coverAlt}
				className='size-full object-cover transition-transform duration-300 ease-out group-hover/post:scale-[1.03] motion-reduce:transition-none'
				height={500}
				sizes='(min-width:1536px) 25vw, (min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw'
				src={post.document.coverImage.src}
				width={800}
			/>
		);
	}

	return (
		<div
			className={cn(
				"flex size-full items-center justify-center bg-muted/60 text-muted-foreground",
				post.generationStatus === "writing" && "animate-pulse motion-reduce:animate-none"
			)}
		>
			<HugeiconsIcon aria-hidden className='size-6 scale-110' icon={News01Icon} strokeWidth={1.75} />
		</div>
	);
};

const BlogPostCard = ({ locale, post }: { locale: "en" | "ar"; post: BlogEditorPost }) => {
	const t = useTranslations("blog");
	const format = useFormatter();
	const status = getPostStatus(post);
	const date = post.publishedAt ?? post.updatedAt;

	return (
		<Link
			className='group/post min-w-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
			href={`/dashboard/blog/${post.id}`}
			prefetch={true}
		>
			<Frame className='h-full'>
				<FramePanel padding='none'>
					<div className='aspect-[16/10] overflow-hidden rounded-[inherit]'>
						<BlogPostCover locale={locale} post={post} />
					</div>
				</FramePanel>
				<div className='grid gap-2 px-3 pt-3 pb-2.5'>
					<p className='line-clamp-2 text-sm font-medium text-pretty'>
						{post.document[locale].title || t("untitled")}
					</p>
					<div className='flex min-w-0 items-center justify-between gap-2'>
						<Badge
							className='shrink-0'
							role={status === "writing" ? "status" : undefined}
							variant={statusVariants[status]}
						>
							{t(status)}
						</Badge>
						<time className='truncate text-xs text-muted-foreground tabular-nums' dateTime={date}>
							{format.dateTime(new Date(date), { day: "numeric", month: "short", timeZone: "UTC" })}
						</time>
					</div>
				</div>
			</Frame>
		</Link>
	);
};

const BlogCreateMenu = ({
	disabled,
	onBlank,
	onGenerate,
	trigger,
}: {
	disabled: boolean;
	onBlank: () => void;
	onGenerate: () => void;
	trigger: ReactElement;
}) => {
	const t = useTranslations("blog");

	return (
		<DropdownMenu>
			<DropdownMenuTrigger disabled={disabled} render={trigger} />
			<DropdownMenuContent>
				<DropdownMenuGroup>
					<DropdownMenuItem onClick={onBlank}>{t("blankDraft")}</DropdownMenuItem>
					<DropdownMenuItem onClick={onGenerate}>{t("generate")}</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export const BlogPage = () => {
	const { can } = useOrganizationPermissions();
	const t = useTranslations("blog");
	const tCommon = useTranslations("common");
	const locale = useLocale() === "ar" ? "ar" : "en";
	const router = useRouter();
	const queryClient = useQueryClient();
	const [params, setParams] = useQueryStates(blogSearchParams);
	const [open, setOpen] = useState(false);

	const query = useQuery({
		...apiClient.blogPosts.list.queryOptions({
			input: { page: Math.max(1, params.page), search: params.q, status: params.status },
		}),
		refetchInterval: (current) =>
			current.state.data?.data.some((post) => post.generationStatus === "writing") ? 2000 : false,
	});

	const create = useMutation({
		mutationFn: async (generation: { instructions: string; topic: string } | null) => {
			const document = createEmptyBlogPostDocument();

			if (generation) {
				document.en.title = generation.topic.trim().slice(0, 200);
			}

			const post = await client.blogPosts.create({ document });

			if (generation) {
				try {
					await client.blogPosts.generate({ ...generation, postId: post.id, revision: post.revision });
				} catch {
					toast.error(t("generationFailed"));
				}
			}

			return post;
		},
		onError: (_error, generation) => {
			if (!generation) {
				toast.error(tCommon("messages.somethingWentWrong"));
			}
		},
		onSuccess: async (post) => {
			await queryClient.invalidateQueries({ queryKey: apiClient.blogPosts.key() });
			router.push(`/dashboard/blog/${post.id}`);
		},
	});

	const empty = query.data?.total === 0 && !params.q && params.status === "all";

	return (
		<>
			<SearchableHeader
				actions={
					<>
						<Select
							items={blogStatuses.map((status) => ({ label: t(status), value: status }))}
							onValueChange={(status) => setParams({ page: 1, status: status ?? "all" })}
							value={params.status}
						>
							<SelectTrigger aria-label={`${t("filter")}: ${t(params.status)}`} iconOnMobile size='sm'>
								<HugeiconsIcon
									aria-hidden
									className='size-4 scale-110 sm:hidden'
									icon={FilterMailIcon}
									strokeWidth={1.75}
								/>
								<SelectValue className='hidden sm:block' />
							</SelectTrigger>
							<SelectPopup>
								{blogStatuses.map((status) => (
									<SelectItem key={status} value={status}>
										{t(status)}
									</SelectItem>
								))}
							</SelectPopup>
						</Select>
						{can("workspace.write") && (
							<BlogCreateMenu
								disabled={create.isPending}
								onBlank={() => create.mutate(null)}
								onGenerate={() => setOpen(true)}
								trigger={
									<Button aria-label={t("newPost")}>
										<HugeiconsIcon className='scale-110' icon={Add01Icon} strokeWidth={1.75} />
										<span className='hidden sm:inline'>{t("newPost")}</span>
									</Button>
								}
							/>
						)}
					</>
				}
				className='flex-nowrap gap-2 px-4 md:px-5'
				item={{ labelTx: "blog" }}
				leading={
					<>
						<HugeiconsIcon
							aria-hidden
							className='hidden size-4 scale-110 text-muted-foreground sm:block'
							icon={News01Icon}
							strokeWidth={1.75}
						/>
						<h1 className='text-base'>{t("title")}</h1>
					</>
				}
				onSearchChange={(q) => setParams({ page: 1, q })}
				search={params.q}
				searchPlaceholder={t("search")}
			/>
			<main className='min-h-0 flex-1 overflow-y-auto p-4 md:p-6'>
				{query.isError && (
					<div role='alert'>
						<p>{t("loadError")}</p>
						<Button onClick={() => query.refetch()} variant='outline'>
							{t("retry")}
						</Button>
					</div>
				)}
				<div className='grid gap-4'>
					{empty ? (
						<Empty className='min-h-80'>
							<EmptyHeader>
								<EmptyMedia variant='icon'>
									<HugeiconsIcon aria-hidden icon={News01Icon} strokeWidth={1.75} />
								</EmptyMedia>
								<EmptyTitle>{t("emptyTitle")}</EmptyTitle>
								<EmptyDescription>{t("createDescription")}</EmptyDescription>
							</EmptyHeader>
							{can("workspace.write") && (
								<EmptyContent>
									<BlogCreateMenu
										disabled={create.isPending}
										onBlank={() => create.mutate(null)}
										onGenerate={() => setOpen(true)}
										trigger={
											<Button>
												<HugeiconsIcon
													aria-hidden
													className='scale-110'
													icon={Add01Icon}
													strokeWidth={1.75}
												/>
												{t("newPost")}
											</Button>
										}
									/>
								</EmptyContent>
							)}
						</Empty>
					) : (
						<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'>
							{query.isPending &&
								["a", "b", "c"].map((key) => (
									<Skeleton
										aria-label={t("loading")}
										className='aspect-[4/3]'
										key={key}
										role='status'
									/>
								))}
							{query.data?.data.map((post) => (
								<BlogPostCard key={post.id} locale={locale} post={post} />
							))}
						</div>
					)}
				</div>
				{query.data?.data.length === 0 && !empty && (
					<Empty className='min-h-64'>
						<EmptyTitle>{t("noResults")}</EmptyTitle>
					</Empty>
				)}
				{query.data && query.data.total > query.data.pageSize && (
					<nav aria-label={t("pagination")} className='mt-10 flex items-center justify-center gap-4'>
						<Button
							disabled={params.page <= 1}
							onClick={() => setParams({ page: params.page - 1 })}
							variant='outline'
						>
							{t("previous")}
						</Button>
						<span className='text-sm'>{params.page}</span>
						<Button
							disabled={params.page * query.data.pageSize >= query.data.total}
							onClick={() => setParams({ page: params.page + 1 })}
							variant='outline'
						>
							{t("next")}
						</Button>
					</nav>
				)}
			</main>
			<BlogGenerationDialog
				busy={create.isPending}
				error={create.isError ? tCommon("messages.somethingWentWrong") : undefined}
				initialTopic={params.topic}
				key={params.topic || "new"}
				onGenerate={(input) => create.mutate(input)}
				onOpenChange={(nextOpen) => {
					setOpen(nextOpen);

					if (!nextOpen && params.topic) {
						setParams({ topic: "" });
					}
				}}
				open={can("workspace.write") && (open || Boolean(params.topic))}
			/>
		</>
	);
};
