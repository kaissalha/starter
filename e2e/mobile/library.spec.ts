import { expect, test, type Page } from "@playwright/test";

import { expectHeaderControlsFit, expectInViewport, expectNoHorizontalOverflow } from "../fixtures/mobile";
import { createSamplePdf } from "../fixtures/pdf";
import { resetWorkspaceLibrary } from "../fixtures/workspace";

const openAsset = async (page: Page, name: string) => {
	await page.goto("/dashboard/library");
	await page.getByRole("link", { name: new RegExp(name, "u") }).tap();
	await expect(page.getByLabel("File name")).toHaveText(name);
};

test.beforeEach(async ({ page }) => {
	await resetWorkspaceLibrary();
	await page.route("https://e2e.invalid/booking-guide.pdf", (route) =>
		route.fulfill({
			body: createSamplePdf("Booking guide"),
			contentType: "application/pdf",
			headers: { "access-control-allow-origin": "*" },
		})
	);
});

test("filters the library by type without overflowing the phone screen", async ({ page }) => {
	await page.goto("/dashboard/library");
	await expect(page.getByRole("link", { name: /Booking guide/u })).toBeVisible();
	await expectHeaderControlsFit(page);
	await expectNoHorizontalOverflow(page);
	await page.getByRole("tab", { name: /^Images/u }).tap();
	await expect(page.getByRole("link", { name: /Studio logo/u })).toBeVisible();
	await expect(page.getByRole("link", { name: /Booking guide/u })).toHaveCount(0);
	await page.getByRole("tab", { name: /^Documents/u }).tap();
	await expect(page.getByRole("link", { name: /Booking guide/u })).toBeVisible();
	await expectNoHorizontalOverflow(page);
	await expectInViewport(page.getByRole("textbox", { name: "Write your prompt" }));
});

test("keeps every PDF viewer action reachable on a phone", async ({ page }) => {
	await openAsset(page, "Booking guide");
	await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();

	for (const name of ["Details", "Download", "Delete", "Ask AI", "Back to library"]) {
		await expectInViewport(
			page.getByRole("button", { exact: true, name }).or(page.getByRole("link", { name })).first()
		);
	}

	await expectNoHorizontalOverflow(page);
	await page.getByRole("button", { exact: true, name: "Details" }).tap();
	await expect(page.getByText("application/pdf")).toBeVisible();
	await page.keyboard.press("Escape");

	await page.getByRole("button", { name: "Ask AI" }).tap();
	const prompt = page.getByRole("textbox", { name: "Write your prompt" });
	await expectInViewport(prompt);
	await expect(prompt).toHaveAttribute("placeholder", "Ask about or edit this file…");
});

test("edits and renames a markdown document, then deletes an image", async ({ page }) => {
	await openAsset(page, "Price list");
	await expect(page.getByRole("toolbar", { name: "Formatting" })).toBeVisible();
	const document = page.getByRole("textbox", { name: "Document content" });
	await document.tap();
	await document.press("ControlOrMeta+End");
	await document.pressSequentially(" Cold plunge: 40 CAD");
	await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });

	const name = page.getByLabel("File name");
	await name.fill("Prices 2026");
	await name.blur();
	await page.getByLabel("Back to library").first().tap();
	await expect(page.getByRole("link", { name: /Prices 2026/u })).toBeVisible();

	await page.getByRole("link", { name: /Studio logo/u }).tap();
	await expectInViewport(page.getByRole("button", { name: "Use as logo" }));
	await page.getByRole("button", { exact: true, name: "Delete" }).tap();
	await page.getByRole("dialog", { name: "Delete this file?" }).getByRole("button", { name: "Delete" }).tap();
	await expect(page).toHaveURL(/\/dashboard\/library$/u);
	await expect(page.getByRole("link", { name: /Studio logo/u })).toHaveCount(0);
});
