import { expect, test, type Locator, type Page } from "@playwright/test";

import {
	closeEditorSheet,
	expectHeaderControlsFit,
	expectInViewport,
	expectNoHorizontalOverflow,
	expectSheetPeeksOnSelect,
	openEditorSheet,
	tapRadioCard,
} from "../fixtures/mobile";
import { resetWorkspaceWebsite } from "../fixtures/workspace";

const blocks = (page: Page) => page.locator("[data-links-block-id]");

const blockLabels = (page: Page) =>
	page
		.locator("[data-links-block-content]")
		.evaluateAll((items) => items.map((item) => item.textContent?.trim() ?? ""));

const linksSave = (page: Page) =>
	page.waitForResponse((response) => response.url().includes("/linkPages/save") && response.ok());

const openLinksEditor = async (page: Page) => {
	await page.route("**/api/rpc/linkPreviews/get**", (route) => route.fulfill({ status: 500 }));
	await page.goto("/dashboard/links");
	await expect(page.getByRole("button", { name: "Open publish panel" })).toBeVisible();
	await expect(blocks(page).first()).toBeVisible();
};

const selectBlock = async (block: Locator) => {
	await block.locator("[data-links-block-content]").tap({ position: { x: 6, y: 6 } });
	const actions = block.page().getByRole("toolbar", { name: "Section actions" });
	await expect(actions).toBeVisible();

	return actions;
};

const addLink = async (page: Page, url: string) => {
	const count = await blocks(page).count();
	const add = page.getByRole("button", { name: "Add section" }).last();
	await expectInViewport(add);
	await add.tap();
	const sheet = page.getByRole("dialog", { name: "Customize" });
	await sheet.getByRole("textbox", { name: "Paste a link" }).fill(url);
	await sheet.getByRole("button", { exact: true, name: "Add" }).tap();
	await expect(blocks(page)).toHaveCount(count + 1);
	await expect(sheet.getByRole("heading", { name: "Link" })).toBeVisible();

	return sheet;
};

test.beforeEach(async () => {
	await resetWorkspaceWebsite();
});

test("shows a full-width preview with a visible add control and a header that fits", async ({ page }) => {
	await openLinksEditor(page);
	await expectHeaderControlsFit(page);
	await expectNoHorizontalOverflow(page);
	const preview = await page.locator("[data-links-viewport]").boundingBox();
	expect(preview?.width).toBe(page.viewportSize()?.width);
	await expectInViewport(page.getByRole("button", { name: "Add section" }).last());
});

test("adds a link from the trailing add control and edits it in the bottom sheet", async ({ page }) => {
	await openLinksEditor(page);
	const saved = linksSave(page);
	const sheet = await addLink(page, "example.com/menu");
	await expect(sheet.getByRole("textbox", { name: "URL" })).toHaveValue("https://example.com/menu");
	await sheet.getByRole("textbox", { name: "Badge" }).fill("New");
	await sheet.getByRole("button", { name: "Done" }).tap();
	await expect(sheet.getByRole("button", { name: "Theme" })).toBeVisible();
	await saved;
	await page.reload();
	await expect.poll(() => blockLabels(page)).toContainEqual(expect.stringContaining("example.com"));
});

test("reorders, designs, and deletes a link from the bottom action bar without covering it", async ({ page }) => {
	await openLinksEditor(page);
	const sheet = await addLink(page, "example.com/booking");
	await closeEditorSheet(sheet);
	const before = await blockLabels(page);

	const first = blocks(page).first();
	const actions = await selectBlock(first);
	const blockBox = await first.boundingBox();
	const actionsBox = await actions.boundingBox();
	expect(blockBox && actionsBox && actionsBox.y > blockBox.y + blockBox.height).toBe(true);

	await actions.getByRole("button", { name: "Move down" }).tap();
	await expect.poll(() => blockLabels(page)).toEqual([before[1], before[0]]);

	await actions.getByRole("button", { name: "Design" }).tap();
	const reopened = page.getByRole("dialog", { name: "Customize" });
	await expect(reopened.getByRole("heading", { name: "Link" })).toBeVisible();
	const selected = await blocks(page).nth(1).boundingBox();
	const sheetBox = await reopened.boundingBox();
	expect(selected && sheetBox && selected.y + selected.height <= sheetBox.y).toBe(true);

	await blocks(page)
		.first()
		.locator("[data-links-block-content]")
		.tap({ position: { x: 6, y: 6 } });
	await expect(reopened.getByRole("textbox", { name: "URL" })).toHaveValue("https://example.com/booking");
	await closeEditorSheet(reopened);

	await (await selectBlock(blocks(page).first())).getByRole("button", { name: "Delete" }).tap();
	await expect(blocks(page)).toHaveCount(before.length - 1);
});

test("edits profile text inline with undo and redo", async ({ page }) => {
	await openLinksEditor(page);
	const title = page.getByRole("textbox", { name: "Edit link page text" }).filter({ hasText: "Nordic Edge" }).first();
	await title.tap();
	await title.fill("Nordic Edge Studio");
	await title.blur();
	await expect(title).toHaveText("Nordic Edge Studio");
	await page.getByRole("button", { name: "Undo" }).tap();
	await expect(page.getByRole("textbox", { name: "Edit link page text" }).first()).toHaveText("Nordic Edge");
	await page.getByRole("button", { name: "Redo" }).tap();
	await expect(page.getByRole("textbox", { name: "Edit link page text" }).first()).toHaveText("Nordic Edge Studio");

	await page.getByRole("combobox", { name: "Language: English" }).tap();
	await page.getByRole("option", { name: /Arabic/u }).tap();
	await expect(page.getByRole("combobox", { name: "Language: Arabic" })).toBeVisible();
	await expectNoHorizontalOverflow(page);
});

test("drops the sheet to a peek to preview the page and brings it back up", async ({ page }) => {
	await openLinksEditor(page);
	const sheet = await openEditorSheet(page);
	await sheet.getByRole("button", { name: "Theme" }).tap();
	await expectSheetPeeksOnSelect(sheet, { option: sheet.getByRole("radio", { name: "Aberdeen" }), panel: "Theme" });
	await expect(blocks(page).first()).toBeInViewport();
});

test("customizes theme, background, buttons, and text with menus above the sheet", async ({ page }) => {
	await openLinksEditor(page);
	const sheet = await openEditorSheet(page);

	await sheet.getByRole("button", { name: "Theme" }).tap();
	await tapRadioCard(sheet.getByRole("radiogroup", { name: "Theme" }), "Aberdeen");
	await sheet.getByRole("button", { name: "Done" }).tap();

	await sheet.getByRole("button", { name: "Background" }).tap();
	const background = sheet.getByRole("radiogroup", { name: "Background" }).getByRole("radio", { checked: false });
	await background.first().locator("xpath=ancestor::label[1]").tap();
	await sheet.getByRole("heading", { name: "Background" }).tap();
	await expect(sheet.getByRole("button", { name: "Done" })).toBeEnabled();
	await sheet.getByRole("button", { name: "Done" }).tap();

	await sheet.getByRole("button", { name: "Buttons" }).tap();
	await expect(blocks(page).first()).toBeInViewport();
	await sheet.getByRole("button", { exact: true, name: "Outline" }).tap();
	await sheet.getByRole("combobox", { name: "Surface effect" }).tap();
	const option = page.getByRole("option", { name: "Concave" });
	await expectInViewport(option);
	await option.tap();
	await expect(sheet.getByRole("combobox", { name: "Surface effect" })).toContainText("Concave");
	await sheet.getByRole("button", { name: "Done" }).tap();

	await sheet.getByRole("button", { name: "Text" }).tap();
	await sheet.getByRole("button", { exact: true, name: "Custom" }).tap();
	await sheet.getByRole("combobox", { name: "Heading font" }).tap();
	await page.getByRole("option").nth(2).tap();
	const saved = linksSave(page);
	await sheet.getByRole("button", { name: "Done" }).tap();
	await saved;

	await sheet.getByRole("button", { name: "Buttons" }).tap();
	await expect(sheet.getByRole("button", { exact: true, name: "Outline" })).toHaveAttribute("aria-pressed", "true");
	await sheet.getByRole("button", { exact: true, name: "Glass" }).tap();
	await sheet.getByRole("button", { name: "Cancel" }).tap();
	await sheet.getByRole("button", { name: "Buttons" }).tap();
	await expect(sheet.getByRole("button", { exact: true, name: "Outline" })).toHaveAttribute("aria-pressed", "true");
});

test("switching panels from the preview keeps earlier edits when the new panel is cancelled", async ({ page }) => {
	await openLinksEditor(page);
	const sheet = await openEditorSheet(page);
	await sheet.getByRole("button", { name: "Buttons" }).tap();
	await sheet.getByRole("button", { exact: true, name: "Outline" }).tap();

	await page
		.locator("[data-links-profile]")
		.first()
		.tap({ position: { x: 8, y: 8 } });
	await expect(sheet.getByRole("heading", { exact: true, name: "Header" }).first()).toBeVisible();
	await sheet.getByRole("button", { name: "Cancel" }).tap();

	await sheet.getByRole("button", { name: "Buttons" }).tap();
	await expect(sheet.getByRole("button", { exact: true, name: "Outline" })).toHaveAttribute("aria-pressed", "true");
	await closeEditorSheet(sheet);
	await page.getByRole("banner").getByRole("button", { name: "Customize" }).tap();
	await expect(sheet.getByRole("button", { name: "Theme" })).toBeVisible();
});

test("adds social icons and reorders collection links with buttons", async ({ page }) => {
	await openLinksEditor(page);
	await page.getByRole("button", { name: "Add section" }).last().tap();
	const sheet = page.getByRole("dialog", { name: "Customize" });
	await sheet.getByRole("button", { name: /^Social icons/u }).tap();
	await sheet.getByRole("button", { name: "Add social icon" }).tap();
	await sheet.getByRole("button", { name: /^Instagram/u }).tap();
	await sheet.getByRole("textbox", { name: "Instagram · Profile link" }).fill("https://instagram.com/nordicedge");
	await sheet.getByRole("button", { name: "Done" }).tap();

	await page.getByRole("button", { name: "Add section" }).last().tap();
	await sheet.getByRole("button", { name: /^Collection/u }).tap();
	const collection = sheet.getByRole("group", { name: "Links in this collection" });
	await sheet.getByRole("button", { name: "Add link" }).tap();
	const urls = collection.getByRole("textbox", { name: "URL" });
	await expect(urls).toHaveCount(2);
	await urls.nth(0).fill("https://example.com/first");
	await urls.nth(1).fill("https://example.com/second");
	await collection.getByRole("button", { name: "Move down" }).first().tap();
	await expect(urls.nth(0)).toHaveValue("https://example.com/second");
	await expect(collection.getByRole("button", { name: "Move up" }).first()).toBeDisabled();
	await sheet.getByRole("button", { name: "Done" }).tap();
	await expectNoHorizontalOverflow(page);
});

test("previews and publishes the links page", async ({ page }) => {
	await openLinksEditor(page);
	await page.getByRole("switch", { name: "Preview" }).tap();
	await expect(page.getByRole("textbox", { name: "Edit link page text" })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
	await expectHeaderControlsFit(page);
	await page.getByRole("switch", { name: "Preview" }).tap();
	await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();

	await page.getByRole("button", { name: "Open publish panel" }).tap();
	const publish = page.getByRole("dialog", { name: "Publish your links" });
	const action = publish.getByRole("button", { exact: true, name: "Publish" });
	await expectInViewport(action);
	await action.tap();
	await expect(page.getByText("Links page published")).toBeVisible();
});
