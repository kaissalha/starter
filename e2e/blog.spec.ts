import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { blogPosts, db, websites } from "@starter/db";
import { createEmptyBlogPostDocument } from "@starter/infinite-website";

import { publicWebsiteId, publicWebsiteOrganizationId } from "./fixtures/website";
import { getWorkspaceOrganizationId } from "./fixtures/workspace";

test.afterEach(async () => {
	await db
		.update(websites)
		.set({ organizationId: publicWebsiteOrganizationId })
		.where(eq(websites.id, publicWebsiteId));
});

test("writes both languages, publishes the saved revision, and isolates later edits", async ({ page }) => {
	test.setTimeout(120_000);
	const organizationId = await getWorkspaceOrganizationId();
	await db.update(websites).set({ organizationId }).where(eq(websites.id, publicWebsiteId));
	await page.goto("/dashboard/blog");
	await page.getByRole("button", { exact: true, name: "New Post" }).first().click();
	await page.getByRole("menuitem", { name: "Start a blank draft" }).click();
	await expect(page).toHaveURL(/\/dashboard\/blog\/[\da-f-]+$/u, { timeout: 30_000 });
	const editorURL = page.url();
	await page.getByRole("textbox", { exact: true, name: "Title" }).fill("Browser verified article");
	await page.getByRole("textbox", { name: "Article body" }).fill("A carefully saved English article.");
	await page.getByRole("textbox", { name: "Article body" }).press("ControlOrMeta+A");
	await expect(page.getByRole("toolbar", { name: "Text formatting" })).toBeVisible();
	await page.getByRole("button", { exact: true, name: "Bold" }).click();
	await expect(page.locator("article strong")).toHaveText("A carefully saved English article.");
	await page.getByRole("textbox", { exact: true, name: "Title" }).press("ControlOrMeta+A");
	await page.getByRole("textbox", { exact: true, name: "Title" }).press("ArrowRight");
	await page.getByRole("textbox", { exact: true, name: "Title" }).pressSequentially(" revised");
	await expect(page.getByRole("textbox", { exact: true, name: "Title" })).toHaveText(
		"Browser verified article revised"
	);
	await page.getByRole("textbox", { exact: true, name: "Title" }).fill("Browser verified article");

	const contentHeights = () =>
		page.evaluate(() =>
			["article h1", 'article [aria-label="Article body"]'].map(
				(selector) => document.querySelector(selector)?.getBoundingClientRect().height
			)
		);

	const heightsBeforePreview = await contentHeights();
	await page.getByRole("switch", { exact: true, name: "Preview" }).check();
	await expect(
		page.locator('article [contenteditable="true"], article [contenteditable="plaintext-only"]')
	).toHaveCount(0);
	await expect(page.getByRole("toolbar", { name: "Text formatting" })).toHaveCount(0);
	await expect.poll(contentHeights).toEqual(heightsBeforePreview);
	await page.getByRole("switch", { exact: true, name: "Preview" }).uncheck();
	await expect(page.getByRole("textbox", { name: "Article body" })).toContainText(
		"A carefully saved English article."
	);
	await page.getByRole("textbox", { name: "Article body" }).press("ControlOrMeta+z");
	await expect(page.locator("article strong")).toHaveCount(0);
	await page.getByRole("textbox", { name: "Article body" }).press("ControlOrMeta+Shift+z");
	await expect(page.locator("article strong")).toHaveText("A carefully saved English article.");
	await page.screenshot({ fullPage: true, path: "test-results/blog-editor-desktop.png" });
	await expect(page.getByRole("button", { exact: true, name: "Publish" })).toBeDisabled();
	await page.getByRole("combobox", { name: "Language: English" }).click();
	await page.getByRole("option", { name: /Arabic/u }).click();
	await page.getByRole("textbox", { exact: true, name: "Title" }).fill("مقال تم التحقق منه");
	await page.getByRole("textbox", { name: "Article body" }).fill("محتوى المقال باللغة العربية.");
	await expect(page.locator('[lang="ar"][dir="rtl"]').first()).toBeVisible();
	await page.getByRole("button", { exact: true, name: "Post settings" }).click();
	await page.getByRole("textbox", { exact: true, name: "URL slug" }).fill("browser-verified");
	await page.getByRole("button", { exact: true, name: "Publish" }).click();
	await expect(page.getByRole("button", { exact: true, name: "Update published post" })).toBeEnabled();
	await page.goto("http://018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339.localhost:3101/");
	await expect(page.getByRole("link", { exact: true, name: "Browser verified article" })).toBeVisible();
	await page.goto("http://018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339.localhost:3101/blog/browser-verified");
	await expect(page.getByRole("heading", { exact: true, name: "Browser verified article" })).toBeVisible();
	await expect(page.getByText("A carefully saved English article.")).toBeVisible();
	const header = await page.locator(".website-container [data-website-anchor]").first().boundingBox();
	const back = await page.getByRole("link", { exact: true, name: "Back to Blog" }).boundingBox();

	if (!header || !back) {
		throw new Error("Article shell is missing");
	}

	expect(back.y).toBeGreaterThanOrEqual(header.y + header.height);
	await expect(page.locator("article strong")).toHaveText("A carefully saved English article.");

	const missingTargets = await page.locator('a[href^="#"]').evaluateAll((links) =>
		links.flatMap((link) => {
			const href = link.getAttribute("href");

			return href && !document.getElementById(href.slice(1)) ? [href] : [];
		})
	);

	expect(missingTargets).toEqual([]);
	await expect(page.locator('a[href*="%23"], a[href*="%3F"]')).toHaveCount(0);
	await page.locator('a[hreflang="ar"]').click();
	await expect(page).toHaveURL("http://018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339.localhost:3101/ar/blog/browser-verified");
	await expect(page.getByRole("heading", { exact: true, name: "مقال تم التحقق منه" })).toBeVisible();
	await page.screenshot({ fullPage: true, path: "test-results/blog-article-arabic.png" });
	await page.setViewportSize({ height: 844, width: 390 });
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.goto(editorURL);
	await page.getByRole("textbox", { exact: true, name: "Title" }).fill("Unpublished title change");
	await expect(page.getByText("Saved", { exact: true })).toBeVisible();
	await page.goto("http://018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339.localhost:3101/blog/browser-verified");
	await expect(page.getByRole("heading", { exact: true, name: "Browser verified article" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Unpublished title change" })).toHaveCount(0);
	await page.goto(editorURL);
	await page.getByRole("button", { exact: true, name: "Blog actions" }).click();
	await page.getByRole("menuitem", { exact: true, name: "Unpublish" }).click();
	await expect(page.getByRole("button", { exact: true, name: "Publish" })).toBeEnabled();

	const response = await page.goto(
		"http://018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339.localhost:3101/blog/browser-verified"
	);

	expect(response?.status()).toBe(404);
	await page.goto("http://018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339.localhost:3101/");
	await expect(page.getByRole("link", { exact: true, name: "Browser verified article" })).toHaveCount(0);
});

test("paginates beyond twenty dashboard posts and adapts the grid to mobile", async ({ page }) => {
	const organizationId = await getWorkspaceOrganizationId();
	await db.insert(blogPosts).values(
		Array.from({ length: 25 }, (_, index) => {
			const document = createEmptyBlogPostDocument();
			document.en.title = `Pagination article ${index}`;

			return { document, organizationId, slug: `pagination-${index}` };
		})
	);
	await page.setViewportSize({ height: 1000, width: 1600 });
	await page.goto("/dashboard/blog?q=Pagination");
	const cards = page.getByRole("link", { name: /Pagination article/u });
	await expect(cards).toHaveCount(20);
	await expect
		.poll(() =>
			cards
				.first()
				.evaluate((element) =>
					element.parentElement
						? getComputedStyle(element.parentElement).gridTemplateColumns.split(" ").length
						: 0
				)
		)
		.toBe(4);
	await page.screenshot({ fullPage: true, path: "test-results/blog-grid-desktop.png" });
	await page.getByRole("button", { exact: true, name: "Next" }).click();
	await expect(cards).toHaveCount(5);
	await expect(page.getByRole("button", { exact: true, name: "Next" })).toBeDisabled();
	await page.setViewportSize({ height: 844, width: 390 });
	await expect
		.poll(() =>
			cards
				.first()
				.evaluate((element) =>
					element.parentElement
						? getComputedStyle(element.parentElement).gridTemplateColumns.split(" ").length
						: 0
				)
		)
		.toBe(1);
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({ fullPage: true, path: "test-results/blog-grid-mobile.png" });
});
