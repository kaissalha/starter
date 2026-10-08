import { expect, test } from "@playwright/test";

import { expectHeaderControlsFit, expectNoHorizontalOverflow } from "../fixtures/mobile";
import { resetWorkspaceRecords, resetWorkspaceWebsite } from "../fixtures/workspace";

test.beforeEach(async () => {
	await resetWorkspaceWebsite();
	await resetWorkspaceRecords();
});

test("writes a draft with the sticky formatting toolbar, edits settings, and deletes it", async ({ page }) => {
	await page.goto("/dashboard/blog");
	await expectHeaderControlsFit(page);
	await page.getByRole("button", { exact: true, name: "New Post" }).first().tap();
	await page.getByRole("menuitem", { name: "Start a blank draft" }).tap();
	await expect(page).toHaveURL(/\/dashboard\/blog\/[\da-f-]+$/u, { timeout: 30_000 });
	await expectHeaderControlsFit(page);

	await page.getByRole("textbox", { exact: true, name: "Title" }).fill("Written on a phone");
	const body = page.getByRole("textbox", { name: "Article body" });
	await body.tap();
	const toolbar = page.getByRole("toolbar", { name: "Text formatting" });
	await expect(toolbar).toBeVisible();
	await body.pressSequentially("Sauna tips for winter.");
	await body.press("ControlOrMeta+A");
	await toolbar.getByRole("button", { exact: true, name: "Bold" }).tap();
	await expect(page.locator("article strong")).toHaveText("Sauna tips for winter.");
	await expect(page.getByText("Saved", { exact: true })).toBeAttached({ timeout: 15_000 });

	await page.getByRole("button", { name: "Post settings" }).tap();
	const settings = page.getByRole("dialog", { name: "Post settings" });
	await expect(settings).toBeVisible();
	await settings.getByRole("textbox", { exact: true, name: "URL slug" }).fill("phone-article");
	await page.keyboard.press("Escape");
	await expect(settings).toBeHidden();

	await page.getByRole("button", { exact: true, name: "Blog actions" }).tap();
	await page.getByRole("menuitem", { name: "Site settings" }).tap();
	const site = page.getByRole("dialog", { name: "Site settings" });
	await expect(site).toBeVisible();
	await site.getByRole("button", { exact: true, name: "Close" }).tap();
	await expect(site).toBeHidden();

	await page.getByRole("switch", { exact: true, name: "Preview" }).tap();
	await expect(page.getByRole("toolbar", { name: "Text formatting" })).toHaveCount(0);
	await page.getByRole("switch", { exact: true, name: "Preview" }).tap();

	await page.getByRole("button", { exact: true, name: "Blog actions" }).tap();
	await page.getByRole("menuitem", { name: "Delete post" }).tap();
	await page.getByRole("dialog", { name: "Delete post" }).getByRole("button", { name: "Delete post" }).tap();
	await expect(page).toHaveURL(/\/dashboard\/blog$/u);
	await expect(page.getByText("No posts yet")).toBeVisible();
});

test("searches and filters posts on a phone", async ({ page }) => {
	await page.goto("/dashboard/blog");
	await page.getByRole("button", { exact: true, name: "New Post" }).first().tap();
	await page.getByRole("menuitem", { name: "Start a blank draft" }).tap();
	await expect(page).toHaveURL(/\/dashboard\/blog\/[\da-f-]+$/u, { timeout: 30_000 });
	await page.getByRole("textbox", { exact: true, name: "Title" }).fill("Cold plunge guide");
	await expect(page.getByText("Saved", { exact: true })).toBeAttached({ timeout: 15_000 });
	await page.getByRole("button", { name: "Back to Blog" }).tap();
	await expect(page).toHaveURL(/\/dashboard\/blog$/u);

	await page.getByRole("button", { exact: true, name: "Search" }).tap();
	await page.getByRole("textbox", { name: "Search" }).fill("plunge");
	await expect(page.getByRole("link", { name: /Cold plunge guide/u })).toBeVisible();
	await page.getByRole("button", { name: "Back" }).tap();

	await page.getByRole("combobox", { name: "Filter: All posts" }).tap();
	await page.getByRole("option", { name: "Published" }).tap();
	await expect(page.getByRole("link", { name: /Cold plunge guide/u })).toHaveCount(0);
	await expectNoHorizontalOverflow(page);
});
