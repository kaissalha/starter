import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { blogPosts, db, files, members, organizations, users, websites, websiteVersions } from "@starter/db";
import { createEmptyBlogPostDocument } from "@starter/infinite-website/contracts";
import { upsertGeneratedSection } from "@starter/infinite-website/generation";
import {
	createWebsiteGenerationShell,
	selectWebsiteGenerationProfile,
	type WebsiteGenerationPlan,
} from "@starter/infinite-website/generation";

import type { BlogActor } from "../../src/services/blog-posts/contracts";
import {
	generateBlogPost,
	generateNewBlogPost,
	getBlogPostGenerationStatus,
	translateBlogPost,
} from "../../src/services/blog-posts/generation";
import {
	getPublishedBlogPost,
	listAllPublishedBlogPosts,
	listPublishedBlogPosts,
} from "../../src/services/blog-posts/public";
import {
	cancelBlogPostGeneration,
	createBlogPost,
	deleteBlogPost,
	getBlogPost,
	listBlogPosts,
	publishBlogPost,
	saveGeneratedBlogPost,
	unpublishBlogPost,
	updateBlogPost,
} from "../../src/services/blog-posts/service";
import { createWebsiteGenerationSlots, materializeWebsiteSection } from "../../src/services/websites/generation";
import { splitPersistedWebsiteSite } from "../../src/services/websites/persistence";
import { getPublishedWebsiteState } from "../../src/services/websites/ready-website";
import { cleanupTestActors } from "../helpers/db";

const workflowStatus = vi.hoisted(() => ({ current: "running" }));

const workflowCancel = vi.hoisted(() => vi.fn(async () => {}));

const workflowStart = vi.hoisted(() => vi.fn(async () => ({ runId: "test-blog-run" })));

vi.mock("workflow/api", () => ({
	getRun: () => ({
		cancel: workflowCancel,
		exists: Promise.resolve(true),
		status: Promise.resolve(workflowStatus.current),
	}),
	start: workflowStart,
}));

const cleanupIds: Array<string> = [];

const createActor = async (): Promise<BlogActor> => {
	const id = randomUUID();
	await db.insert(organizations).values({ id, name: "Blog organization", slug: id });
	await db.insert(users).values({ email: `${id}@example.com`, id, name: "Writer" });
	await db.insert(members).values({ id, organizationId: id, role: "owner", userId: id });
	cleanupIds.push(id);

	return { organizationId: id, userId: id };
};

const article = () => {
	const document = createEmptyBlogPostDocument();
	document.en.title = "English title";
	document.ar.title = "عنوان المقال";
	document.en.body = {
		content: [{ content: [{ text: "English article content.", type: "text" }], type: "paragraph" }],
		type: "doc",
	};
	document.ar.body = {
		content: [{ content: [{ text: "محتوى المقال باللغة العربية", type: "text" }], type: "paragraph" }],
		type: "doc",
	};

	return document;
};

const createWebsite = async (actor: BlogActor) => {
	const id = randomUUID();
	const brief = { location: "Toronto", name: "Blog organization", schemaVersion: 1 as const, type: "Design studio" };
	const profile = selectWebsiteGenerationProfile({ businessType: brief.type });

	const plan: WebsiteGenerationPlan = {
		kind: "plan",
		pages: (["home", "about", "services", "faq", "contact"] as const).map((pageKey) => ({
			description: `A ${pageKey} page.`,
			pageKey,
			title: pageKey,
		})),
		siteDescription: "Business",
	};

	const shell = createWebsiteGenerationShell({
		brief,
		localizations: { byLocale: { ar: plan, en: plan }, defaultLocale: "en" },
		profile,
		websiteId: id,
	});

	const [slot] = createWebsiteGenerationSlots({
		businessName: brief.name,
		profileKeyword: "business",
		slots: profile.layout.header,
		templateId: profile.templateId,
		websiteId: id,
	});

	if (!slot) {
		throw new Error("Missing header slot");
	}

	const localized = {
		fields: slot.promptSlot.fields.map(({ path }) => ({ path, value: "Business navigation" })),
		plan,
	};

	const header = materializeWebsiteSection({
		generatedSection: slot,
		localizations: { byLocale: { ar: localized, en: localized }, defaultLocale: "en" },
		pages: shell.document.structure.pages,
		templateId: profile.templateId,
		websiteId: id,
	});

	const document = upsertGeneratedSection({
		document: shell.document,
		section: { content: header.content, section: header.section, target: header.target },
	});

	await db.insert(websites).values({ brief, id, locale: "en", organizationId: actor.organizationId });

	const [version] = await db
		.insert(websiteVersions)
		.values({
			...splitPersistedWebsiteSite({
				site: {
					assetBindings: {},
					brand: shell.brand,
					document,
					schemaVersion: 1,
					templateId: profile.templateId,
				},
			}),
			publishedAt: new Date().toISOString(),
			version: 1,
			websiteId: id,
		})
		.returning();

	if (!version) {
		throw new Error("Version missing");
	}

	await db
		.update(websites)
		.set({ draftVersionId: version.id, publishedVersionId: version.id })
		.where(eq(websites.id, id));

	return id;
};

afterEach(async () => {
	await cleanupTestActors(cleanupIds);
	workflowStart.mockClear();
	workflowCancel.mockClear();
	workflowStatus.current = "running";
});

describe("Blog persistence", () => {
	it("orders the editor published feed by publication time consistently with public pages", async () => {
		const actor = await createActor();
		const websiteId = await createWebsite(actor);
		const older = await createBlogPost({ actor, input: { document: article(), slug: "older-draft" } });
		const newer = await createBlogPost({ actor, input: { document: article(), slug: "newer-draft" } });
		await publishBlogPost({ actor, input: { postId: newer.id, revision: newer.revision } });
		await publishBlogPost({ actor, input: { postId: older.id, revision: older.revision } });
		await db.update(blogPosts).set({ publishedAt: "2026-01-01T00:00:00.000Z" }).where(eq(blogPosts.id, newer.id));
		const dashboard = await listBlogPosts({ actor, input: { pageSize: 6, status: "published" } });
		const publicFeed = await listPublishedBlogPosts({ pageSize: 6, websiteId });
		expect(dashboard.data.map((post) => post.id)).toEqual([older.id, newer.id]);
		expect(publicFeed.data.map((post) => post.id)).toEqual(dashboard.data.map((post) => post.id));
	});

	it("keeps published modified timestamps stable across draft edits and updates them on publication", async () => {
		const actor = await createActor();
		const websiteId = await createWebsite(actor);
		const draft = await createBlogPost({ actor, input: { document: article(), slug: "timing" } });
		const published = await publishBlogPost({ actor, input: { postId: draft.id, revision: draft.revision } });
		const before = await getPublishedBlogPost({ slug: draft.slug, websiteId });
		const document = article();
		document.en.title = "Draft edit";

		const edited = await updateBlogPost({
			actor,
			input: { document, postId: draft.id, revision: published.revision, slug: draft.slug },
		});

		expect((await getPublishedBlogPost({ slug: draft.slug, websiteId }))?.updatedAt).toBe(before?.updatedAt);
		expect((await listAllPublishedBlogPosts({ websiteId }))[0]?.updatedAt).toBe(before?.updatedAt);
		const republished = await publishBlogPost({ actor, input: { postId: draft.id, revision: edited.revision } });
		const after = await getPublishedBlogPost({ slug: draft.slug, websiteId });
		expect(after?.document.en.title).toBe("Draft edit");
		expect(after?.publishedAt).toBe(before?.publishedAt);
		expect(Date.parse(after?.updatedAt ?? "")).toBeGreaterThan(Date.parse(before?.updatedAt ?? ""));
		expect(republished.revision).toBe(edited.revision + 1);
	});
	it("keeps the original publication date when a post is unpublished and republished", async () => {
		const actor = await createActor();
		const websiteId = await createWebsite(actor);
		const draft = await createBlogPost({ actor, input: { document: article(), slug: "original-date" } });
		const published = await publishBlogPost({ actor, input: { postId: draft.id, revision: draft.revision } });
		const before = await getPublishedBlogPost({ slug: draft.slug, websiteId });

		const unpublished = await unpublishBlogPost({
			actor,
			input: { postId: draft.id, revision: published.revision },
		});

		await new Promise((resolve) => setTimeout(resolve, 5));
		await publishBlogPost({ actor, input: { postId: draft.id, revision: unpublished.revision } });
		expect((await getPublishedBlogPost({ slug: draft.slug, websiteId }))?.publishedAt).toBe(before?.publishedAt);
	});
	it("lists each published post with its available locales", async () => {
		const actor = await createActor();
		const websiteId = await createWebsite(actor);
		const plain = await createBlogPost({ actor, input: { document: article(), slug: "plain" } });
		await publishBlogPost({ actor, input: { postId: plain.id, revision: plain.revision } });
		const translated = article();
		translated.translations = { fr: { ...translated.en } };
		const french = await createBlogPost({ actor, input: { document: translated, slug: "french" } });
		await publishBlogPost({ actor, input: { postId: french.id, revision: french.revision } });
		const posts = await listAllPublishedBlogPosts({ websiteId });
		expect(posts.find(({ slug }) => slug === "plain")?.locales).toEqual(["en", "ar"]);
		expect(posts.find(({ slug }) => slug === "french")?.locales).toEqual(["en", "ar", "fr"]);
	});
	it("recovers failed workflow starts and terminal runs, and never overwrites a newer edit", async () => {
		const actor = await createActor();
		const post = await createBlogPost({ actor, input: {} });
		workflowStart.mockRejectedValueOnce(new Error("Unavailable"));
		await expect(
			generateBlogPost({ actor, input: { postId: post.id, revision: post.revision, topic: "Topic" } })
		).rejects.toThrow("Unavailable");
		const failed = await getBlogPost({ actor, postId: post.id });
		expect(failed.generationStatus).toBe("failed");

		const writing = await generateBlogPost({
			actor,
			input: { postId: post.id, revision: failed.revision, topic: "Retry" },
		});

		const [claim] = await db.select().from(blogPosts).where(eq(blogPosts.id, post.id));

		if (!claim?.generationToken) {
			throw new Error("Missing claim");
		}

		const edited = await updateBlogPost({
			actor,
			input: { document: article(), postId: post.id, revision: writing.revision, slug: post.slug },
		});

		expect(
			await saveGeneratedBlogPost({
				document: article(),
				organizationId: actor.organizationId,
				postId: post.id,
				token: claim.generationToken,
			})
		).toBeNull();

		const retry = await generateBlogPost({
			actor,
			input: { postId: post.id, revision: edited.revision, topic: "Another draft" },
		});

		workflowStatus.current = "failed";
		const terminal = await getBlogPost({ actor, postId: post.id });
		expect(terminal.generationStatus).toBe("failed");
		expect(terminal.document).toEqual(edited.document);
		expect(terminal.revision).toBe(retry.revision);
	});
	it("creates and starts writing a new draft in one step and reports its generation status", async () => {
		const actor = await createActor();
		const post = await generateNewBlogPost({ actor, input: { topic: "Spring garden care" } });
		expect(post).toMatchObject({
			generationRunId: "test-blog-run",
			generationStatus: "writing",
			publishedAt: null,
		});
		expect(post.document.en.title).toBe("Spring garden care");
		expect(workflowStart).toHaveBeenLastCalledWith(expect.anything(), [
			expect.objectContaining({ instructions: "", postId: post.id, topic: "Spring garden care" }),
		]);
		await expect(getBlogPostGenerationStatus({ actor, postId: post.id })).resolves.toEqual({
			generationError: null,
			generationRunId: "test-blog-run",
			generationStatus: "writing",
			id: post.id,
			revision: post.revision,
			updatedAt: post.updatedAt,
		});
		const outsider = await createActor();
		await expect(
			getBlogPostGenerationStatus({ actor: { ...actor, userId: outsider.userId }, postId: post.id })
		).rejects.toThrow("You do not have permission to perform this action.");
		await expect(getBlogPostGenerationStatus({ actor: outsider, postId: post.id })).rejects.toThrow(
			"Blog post not found."
		);
	});
	it("requires a source article and preserves partial target translations", async () => {
		const actor = await createActor();
		const post = await createBlogPost({ actor, input: {} });
		await expect(
			translateBlogPost({ actor, input: { locale: "ar", postId: post.id, revision: post.revision } })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		const document = article();
		document.ar = createEmptyBlogPostDocument().ar;
		document.ar.seoTitle = "عنوان محفوظ";

		const saved = await updateBlogPost({
			actor,
			input: { document, postId: post.id, revision: post.revision, slug: post.slug },
		});

		await expect(
			translateBlogPost({ actor, input: { locale: "ar", postId: post.id, revision: saved.revision } })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("isolates tenants and rechecks revoked membership", async () => {
		const actor = await createActor();
		const other = await createActor();
		const post = await createBlogPost({ actor, input: {} });
		await expect(getBlogPost({ actor: other, postId: post.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(
			deleteBlogPost({ actor: other, input: { postId: post.id, revision: post.revision } })
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		await db.delete(members).where(eq(members.id, actor.userId));
		await expect(getBlogPost({ actor, postId: post.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
	it("requires bilingual text, freezes published snapshots and permanently locks published slugs", async () => {
		const actor = await createActor();
		const post = await createBlogPost({ actor, input: {} });
		await expect(
			publishBlogPost({ actor, input: { postId: post.id, revision: post.revision } })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		const saved = await updateBlogPost({
			actor,
			input: { document: article(), postId: post.id, revision: post.revision, slug: "article" },
		});

		const published = await publishBlogPost({ actor, input: { postId: post.id, revision: saved.revision } });
		const document = article();
		document.en.title = "Unpublished edit";

		const edited = await updateBlogPost({
			actor,
			input: { document, postId: post.id, revision: published.revision, slug: published.slug },
		});

		expect(edited.document.en.title).toBe("Unpublished edit");
		expect(edited.publishedDocument?.en.title).toBe("English title");
		const unpublished = await unpublishBlogPost({ actor, input: { postId: post.id, revision: edited.revision } });
		await expect(
			updateBlogPost({
				actor,
				input: { document, postId: post.id, revision: unpublished.revision, slug: "different" },
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
	it("derives a readable, unique slug from the English title at first publication only", async () => {
		const actor = await createActor();

		const publish = async (input: { document: ReturnType<typeof article>; slug?: string }) => {
			const post = await createBlogPost({ actor, input });

			return publishBlogPost({ actor, input: { postId: post.id, revision: post.revision } });
		};

		const first = await publish({ document: article() });
		expect(first.slug).toBe("english-title");
		expect((await publish({ document: article() })).slug).toBe("english-title-2");
		const accented = article();
		accented.en.title = "  Café Déjà Vu!! ";
		expect((await publish({ document: accented })).slug).toBe("cafe-deja-vu");
		const arabicOnly = article();
		arabicOnly.en.title = "عنوان";
		expect((await publish({ document: arabicOnly })).slug).toMatch(/^post-[\da-f-]{36}$/u);
		expect((await publish({ document: article(), slug: "my-custom-slug" })).slug).toBe("my-custom-slug");
		const unpublished = await unpublishBlogPost({ actor, input: { postId: first.id, revision: first.revision } });
		const document = article();
		document.en.title = "Renamed title";

		const edited = await updateBlogPost({
			actor,
			input: { document, postId: first.id, revision: unpublished.revision, slug: first.slug },
		});

		const republished = await publishBlogPost({ actor, input: { postId: first.id, revision: edited.revision } });
		expect(republished.slug).toBe("english-title");
		await expect(
			updateBlogPost({
				actor,
				input: { document, postId: first.id, revision: republished.revision, slug: "renamed-title" },
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
	it("rejects duplicate slugs and allows only one save at a revision", async () => {
		const actor = await createActor();
		const post = await createBlogPost({ actor, input: { slug: "unique" } });
		await expect(createBlogPost({ actor, input: { slug: "unique" } })).rejects.toMatchObject({ code: "CONFLICT" });

		const results = await Promise.allSettled(
			[1, 2].map(() =>
				updateBlogPost({
					actor,
					input: { document: article(), postId: post.id, revision: post.revision, slug: post.slug },
				})
			)
		);

		expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
		await expect(
			publishBlogPost({ actor, input: { postId: post.id, revision: post.revision } })
		).rejects.toMatchObject({ code: "CONFLICT" });
	});
	it("rejects media owned by another tenant or private media", async () => {
		const actor = await createActor();
		const other = await createActor();
		const document = article();
		document.coverImage = { src: "https://example.com/foreign.jpg" };
		await db.insert(files).values({
			contentType: "image/jpeg",
			kind: "image",
			name: "Cover",
			organizationId: other.organizationId,
			url: document.coverImage.src,
		});
		await expect(createBlogPost({ actor, input: { document } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
	it("paginates beyond twenty posts and excludes unpublished records from public queries", async () => {
		const actor = await createActor();
		const websiteId = await createWebsite(actor);
		await db.insert(blogPosts).values(
			Array.from({ length: 105 }, (_, index) => ({
				document: article(),
				organizationId: actor.organizationId,
				publishedAt: new Date().toISOString(),
				publishedDocument: article(),
				slug: `post-${index}`,
			}))
		);
		const draft = await createBlogPost({ actor, input: { slug: "draft" } });
		expect((await listBlogPosts({ actor, input: { page: 2 } })).data).toHaveLength(20);
		expect((await listBlogPosts({ actor, input: { search: "English title" } })).total).toBe(105);
		expect((await listPublishedBlogPosts({ page: 9, websiteId })).data).toHaveLength(9);
		expect(await listAllPublishedBlogPosts({ websiteId })).toHaveLength(105);
		expect(await getPublishedBlogPost({ slug: draft.slug, websiteId })).toBeNull();
		await db.update(websites).set({ publishedVersionId: null }).where(eq(websites.id, websiteId));
		expect((await listPublishedBlogPosts({ websiteId })).data).toHaveLength(0);
	});
	it("hides published posts while the website is suspended", async () => {
		const actor = await createActor();
		const websiteId = await createWebsite(actor);
		await db.insert(blogPosts).values({
			document: article(),
			organizationId: actor.organizationId,
			publishedAt: new Date().toISOString(),
			publishedDocument: article(),
			slug: "live",
		});
		expect((await listPublishedBlogPosts({ websiteId })).data).toHaveLength(1);
		await db.update(websites).set({ suspendedAt: new Date().toISOString() }).where(eq(websites.id, websiteId));
		expect((await listPublishedBlogPosts({ websiteId })).data).toHaveLength(0);
		expect(await getPublishedBlogPost({ slug: "live", websiteId })).toBeNull();
		expect(await listAllPublishedBlogPosts({ websiteId })).toHaveLength(0);
	});
	it("flags the blog navigation with the published website state exactly when public posts exist", async () => {
		const actor = await createActor();
		const outsider = await createActor();
		const websiteId = await createWebsite(actor);

		const [version] = await db
			.select({ id: websites.publishedVersionId })
			.from(websites)
			.where(eq(websites.id, websiteId));

		const published = { hasBlog: false, publishedVersionId: version?.id };
		expect(await getPublishedWebsiteState({ websiteId })).toEqual(published);
		await db.insert(blogPosts).values([
			{ document: article(), organizationId: actor.organizationId, slug: "draft" },
			{
				document: article(),
				organizationId: outsider.organizationId,
				publishedAt: new Date().toISOString(),
				publishedDocument: article(),
				slug: "outsider",
			},
		]);
		expect(await getPublishedWebsiteState({ websiteId })).toEqual(published);

		const [post] = await db
			.insert(blogPosts)
			.values({
				document: article(),
				organizationId: actor.organizationId,
				publishedAt: new Date().toISOString(),
				publishedDocument: article(),
				slug: "live",
			})
			.returning({ id: blogPosts.id });

		expect(await getPublishedWebsiteState({ websiteId })).toEqual({ ...published, hasBlog: true });
		await db
			.update(blogPosts)
			.set({ publishedAt: null, publishedDocument: null })
			.where(eq(blogPosts.id, post?.id ?? ""));
		expect(await getPublishedWebsiteState({ websiteId })).toEqual(published);
		await db.update(websites).set({ suspendedAt: new Date().toISOString() }).where(eq(websites.id, websiteId));
		expect(await getPublishedWebsiteState({ websiteId })).toBeNull();
		await db
			.update(websites)
			.set({ publishedVersionId: null, suspendedAt: null })
			.where(eq(websites.id, websiteId));
		expect(await getPublishedWebsiteState({ websiteId })).toBeNull();
		expect(await getPublishedWebsiteState({ websiteId: "not-a-uuid" })).toBeNull();
	});
	it("claims durable generation, prevents target translation overwrite and discards cancelled or deleted completions", async () => {
		const actor = await createActor();
		const post = await createBlogPost({ actor, input: {} });

		const writing = await generateBlogPost({
			actor,
			input: { postId: post.id, revision: post.revision, topic: "Topic" },
		});

		expect(writing.generationStatus).toBe("writing");
		expect(workflowStart).toHaveBeenCalledOnce();
		const [claimed] = await db.select().from(blogPosts).where(eq(blogPosts.id, post.id));

		if (!claimed?.generationToken) {
			throw new Error("Missing generation claim");
		}

		const cancelled = await cancelBlogPostGeneration({
			actor,
			input: { postId: post.id, revision: writing.revision },
		});

		expect(
			await saveGeneratedBlogPost({
				document: article(),
				organizationId: actor.organizationId,
				postId: post.id,
				token: claimed.generationToken,
			})
		).toBeNull();

		const saved = await updateBlogPost({
			actor,
			input: { document: article(), postId: post.id, revision: cancelled.revision, slug: post.slug },
		});

		await expect(
			translateBlogPost({ actor, input: { locale: "ar", postId: post.id, revision: saved.revision } })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await deleteBlogPost({ actor, input: { postId: post.id, revision: saved.revision } });
		expect(
			await saveGeneratedBlogPost({
				document: article(),
				organizationId: actor.organizationId,
				postId: post.id,
				token: claimed.generationToken,
			})
		).toBeNull();
	});
	it("cancels the workflow run when a writing post is edited or deleted", async () => {
		const actor = await createActor();
		const edited = await createBlogPost({ actor, input: {} });

		const editing = await generateBlogPost({
			actor,
			input: { postId: edited.id, revision: edited.revision, topic: "Topic" },
		});

		const saved = await updateBlogPost({
			actor,
			input: { document: article(), postId: edited.id, revision: editing.revision, slug: edited.slug },
		});

		expect(saved.generationStatus).toBe("idle");
		expect(workflowCancel).toHaveBeenCalledOnce();
		expect(workflowCancel).toHaveBeenCalledWith({ cancelReason: expect.any(String) });
		workflowCancel.mockClear();
		const removed = await createBlogPost({ actor, input: {} });

		const removing = await generateBlogPost({
			actor,
			input: { postId: removed.id, revision: removed.revision, topic: "Topic" },
		});

		await deleteBlogPost({ actor, input: { postId: removed.id, revision: removing.revision } });
		expect(workflowCancel).toHaveBeenCalledOnce();
	});
});
