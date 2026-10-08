import { and, eq, inArray, isNull } from "drizzle-orm";

import { db, members, files, blogPosts, isUniqueViolation, type Transaction, type BlogPostRecord } from "@starter/db";
import {
	listBlogLocales,
	getBlogLocaleContent,
	type BlogNode,
	type BlogPostDocument,
} from "@starter/infinite-website/contracts";

import { hasOrganizationPermission, type OrganizationPermission } from "../../utils/permissions";
import { BlogPostError, type BlogActor } from "./contracts";

export const requireBlogMember = async ({
	actor,
	permission = "read",
	transaction = db,
}: {
	actor: BlogActor;
	permission?: OrganizationPermission;
	transaction?: Transaction | typeof db;
}) => {
	const [member] = await transaction
		.select({ role: members.role })
		.from(members)
		.where(and(eq(members.userId, actor.userId), eq(members.organizationId, actor.organizationId)))
		.for("share")
		.limit(1);

	if (!member || !hasOrganizationPermission({ permission, role: member.role })) {
		throw new BlogPostError("FORBIDDEN", "You do not have permission to perform this action.");
	}
};

export const readBlogPost = async ({
	organizationId,
	postId,
	transaction = db,
}: {
	organizationId: string;
	postId: string;
	transaction?: Transaction | typeof db;
}) => {
	const [post] = await transaction
		.select()
		.from(blogPosts)
		.where(and(eq(blogPosts.id, postId), eq(blogPosts.organizationId, organizationId)))
		.limit(1);

	if (!post) {
		throw new BlogPostError("NOT_FOUND", "Blog post not found.");
	}

	return post;
};

export const projectBlogPost = ({
	generationToken: _generationToken,
	publishedUpdatedAt: _publishedUpdatedAt,
	...post
}: BlogPostRecord) => post;

export const requireBlogRevision = ({ post, revision }: { post: BlogPostRecord; revision: number }) => {
	if (post.revision !== revision) {
		throw new BlogPostError("CONFLICT", "The post changed elsewhere. Reload before saving.");
	}
};

const collectImageUrls = (nodes: Array<BlogNode>): Array<string> =>
	nodes.flatMap((node) => [
		...(node.type === "image" ? [node.attrs.src] : []),
		...("content" in node && node.content ? collectImageUrls(node.content) : []),
	]);

export const validateBlogMedia = async ({
	document,
	organizationId,
	transaction = db,
}: {
	document: BlogPostDocument;
	organizationId: string;
	transaction?: Transaction | typeof db;
}) => {
	const urls = [
		...new Set([
			...(document.coverImage ? [document.coverImage.src] : []),
			...listBlogLocales(document).flatMap((locale) =>
				collectImageUrls(getBlogLocaleContent({ document, locale }).body.content)
			),
		]),
	];

	if (!urls.length) {
		return;
	}

	const records = await transaction
		.select({ url: files.url })
		.from(files)
		.where(
			and(
				inArray(files.url, urls),
				eq(files.organizationId, organizationId),
				eq(files.access, "public"),
				eq(files.kind, "image"),
				isNull(files.deletedAt)
			)
		);

	const owned = new Set(records.map(({ url }) => url));

	if (urls.some((url) => !owned.has(url))) {
		throw new BlogPostError(
			"BAD_REQUEST",
			"Blog images must be public images from this organization's media library."
		);
	}
};

export const translateBlogDatabaseError = (error: Error) => {
	if (isUniqueViolation({ error })) {
		throw new BlogPostError("CONFLICT", "A post with this slug already exists.");
	}

	throw error;
};
