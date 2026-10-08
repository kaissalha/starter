import { expect, test } from "@playwright/test";

import { expectHeaderControlsFit, expectInViewport, expectNoHorizontalOverflow } from "../fixtures/mobile";
import { resetWorkspaceWebsite } from "../fixtures/workspace";

test.beforeAll(async () => {
	await resetWorkspaceWebsite();
});

test("filters analytics, explains metrics on tap, and opens the live view", async ({ page }) => {
	await page.goto("/dashboard/analytics");
	await expectHeaderControlsFit(page);
	await page.getByRole("combobox", { name: "Dates" }).tap();
	await page.getByRole("option", { name: "Last 7 days" }).tap();
	await expect(page.getByRole("combobox", { name: "Dates" })).toContainText("Last 7 days");
	await page.getByRole("combobox", { name: "Content" }).tap();
	await page.getByRole("option", { name: "Links" }).tap();
	await expect(page.getByRole("combobox", { name: "Content" })).toContainText("Links");

	await page.getByRole("button", { name: "What is Visitors?" }).tap();
	const definition = page.getByRole("dialog");
	await expectInViewport(definition);
	await page.keyboard.press("Escape");
	await expectNoHorizontalOverflow(page);

	await page.getByLabel(/ online$/u).tap();
	await expect(page).toHaveURL(/\/dashboard\/analytics\/live$/u);
	await expect(page.getByRole("img", { name: "Globe showing where current visitors are" })).toBeVisible();
	await page.mouse.wheel(0, 400);
	await page.getByLabel("Back to analytics").first().tap();
	await expect(page).toHaveURL(/\/dashboard\/analytics(\?.*)?$/u);
});

test("works through SEO steps and jumps to traffic on a phone", async ({ page }) => {
	await page.goto("/dashboard/seo-geo");
	await expect(page.getByRole("heading", { name: "Get discovered by customers" })).toBeVisible();
	await expectNoHorizontalOverflow(page);
	await page.getByRole("button", { name: /^Done/u }).tap();
	await page.getByRole("button", { name: /^To do/u }).tap();
	await page.getByText("View traffic").tap();
	await expect(page).toHaveURL(/\/dashboard\/analytics/u);
});
