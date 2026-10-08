import { expect, test, type Page } from "@playwright/test";

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

const heroHeading = "Mobile Sauna & Cold Plunge — Delivered to Your Door";

const heroSection = (page: Page) => page.locator("[data-website-section-id][data-area=page]").first();

const heroControls = (page: Page) => heroSection(page).getByRole("toolbar", { name: "Section controls" });

const openWebsiteEditor = async (page: Page) => {
	await page.goto("/dashboard/website");
	await expect(page.getByRole("button", { name: "Open publish panel" })).toBeVisible();
	const heading = heroSection(page).getByRole("textbox", { name: "Edit website text" }).first();
	await expect(heading).toHaveText(heroHeading);

	return heading;
};

const sectionIds = (page: Page) =>
	page
		.locator("[data-website-section-id][data-area=page]")
		.evaluateAll((sections) => sections.map((section) => section.getAttribute("data-website-section-id")));

const websiteEdit = (page: Page) =>
	page.waitForResponse((response) => response.url().includes("/websites/edit") && response.ok());

test.beforeEach(async () => {
	await resetWorkspaceWebsite();
});

test("fits the website editor header on a phone and switches page, language, and mode", async ({ page }) => {
	const heading = await openWebsiteEditor(page);
	await expectHeaderControlsFit(page);
	await expectNoHorizontalOverflow(page);
	await expect(heading).toBeVisible();

	await page.getByRole("combobox", { name: "Page: Home" }).tap();
	const home = page.getByRole("group", { name: "Main navigation" }).getByRole("option", { name: "Home" });
	await expectInViewport(home);
	await home.tap();
	await expect(page.getByRole("listbox")).toBeHidden();

	await page.getByRole("combobox", { name: "Language: English" }).tap();
	await page.getByRole("option", { name: /Arabic/u }).tap();
	await expect(
		page.getByRole("textbox", { name: "Edit website text" }).filter({ hasText: "ساونا متنقلة" }).first()
	).toBeVisible();
	await page.getByRole("combobox", { name: "Language: Arabic" }).tap();
	await page.getByRole("option", { name: /English/u }).tap();
	await expect(heading).toBeVisible();

	await page.getByRole("switch", { name: "Preview" }).tap();
	await expect(page.getByRole("switch", { name: "Preview" })).toBeChecked();
	await expect(page.getByRole("textbox", { name: "Edit website text" })).toHaveCount(0);
	await expect(page.getByRole("heading", { name: heroHeading })).toBeVisible();
	await expectHeaderControlsFit(page);
	await page.getByRole("switch", { name: "Preview" }).tap();
	await expect(heading).toBeVisible();
});

test("edits text inline and manages sections by touch", async ({ page }) => {
	const heading = await openWebsiteEditor(page);
	await page.getByRole("combobox", { name: "Language: English" }).tap();
	await page.getByRole("option", { name: /Arabic/u }).tap();
	await expect(heading).toContainText("ساونا متنقلة");
	await heading.tap();
	await expectInViewport(heroControls(page));

	const saved = websiteEdit(page);
	await heading.fill("ساونا على عجلات");
	await heading.blur();
	await saved;
	await page.reload();
	await page.getByRole("combobox", { name: "Language: English" }).tap();
	await page.getByRole("option", { name: /Arabic/u }).tap();
	await expect(heading).toHaveText("ساونا على عجلات");

	const before = await sectionIds(page);
	await heading.tap();
	const moved = websiteEdit(page);
	await heroControls(page).getByRole("button", { name: "Move section down" }).tap();
	await moved;
	await expect.poll(() => sectionIds(page)).toEqual([before[1], before[0], ...before.slice(2)]);

	const section = page.locator(`[data-website-section-id="${before[0]}"]`);
	await section.getByRole("textbox", { name: "Edit website text" }).first().tap();
	await section
		.getByRole("toolbar", { name: "Section controls" })
		.getByRole("button", { name: "Delete section" })
		.tap();
	const confirmation = page.getByRole("alertdialog", { name: "Delete this section?" });
	await expect(confirmation).toBeVisible();
	const deleted = websiteEdit(page);
	await confirmation.getByRole("button", { name: "Delete section" }).tap();
	await deleted;
	await expect.poll(async () => (await sectionIds(page)).length).toBe(before.length - 1);
	await expectNoHorizontalOverflow(page);
});

test("opens the section catalog from a focused section and closes it without changes", async ({ page }) => {
	const heading = await openWebsiteEditor(page);
	const before = await sectionIds(page);
	await expect(page.getByRole("button", { name: "Add Section" }).first()).not.toBeVisible();
	await heading.tap();
	const add = page.locator(`[data-website-section-id="${before[0]}"]`).getByRole("button", { name: "Add Section" });
	await expect(add).toBeVisible();
	await add.tap();
	const sheet = page.getByRole("dialog", { name: "Customize" });
	await expect(sheet.getByRole("heading", { name: "Add a section" })).toBeVisible();
	await expect(sheet.getByRole("textbox", { name: "Search section styles" })).toBeVisible();
	await closeEditorSheet(sheet);
	await heading.tap();
	await expect(heroControls(page)).toBeVisible();
	expect(await sectionIds(page)).toEqual(before);
});

test("customizes colors, fonts, and corners in the bottom sheet while the preview stays visible", async ({ page }) => {
	const heading = await openWebsiteEditor(page);
	const sheet = await openEditorSheet(page);
	await expectInViewport(page.getByRole("banner"));
	const sheetBox = await sheet.boundingBox();
	const viewport = page.viewportSize();
	expect(sheetBox && viewport && sheetBox.height < viewport.height * 0.7).toBe(true);

	await sheet.getByRole("button", { name: "Colors" }).tap();
	const primary = sheet.getByLabel("Primary", { exact: true });
	const originalPrimary = await primary.inputValue();
	await tapRadioCard(sheet, "Palette 2");
	await expect(primary).not.toHaveValue(originalPrimary);
	const colors = websiteEdit(page);
	await sheet.getByRole("button", { name: "Done" }).tap();
	await colors;

	await sheet.getByRole("button", { name: "Corners" }).tap();
	await tapRadioCard(sheet, /Square/u);
	const corners = websiteEdit(page);
	await sheet.getByRole("button", { name: "Done" }).tap();
	await corners;

	await sheet.getByRole("button", { name: "Fonts" }).tap();
	const fonts = sheet.getByRole("radiogroup", { name: "Fonts" });
	const pairing = await fonts.getByRole("radio").nth(1).getAttribute("aria-labelledby");
	await tapRadioCard(fonts, await sheet.locator(`[id="${pairing}"]`).innerText());
	const typography = websiteEdit(page);
	await sheet.getByRole("button", { name: "Done" }).tap();
	await typography;

	await sheet.getByRole("button", { name: "Corners" }).tap();
	await tapRadioCard(sheet, /Soft/u);
	await sheet.getByRole("button", { name: "Cancel" }).tap();
	await closeEditorSheet(sheet);
	await expect(heading).toBeVisible();
	await page.reload();
	const reopened = await openEditorSheet(page);
	await reopened.getByRole("button", { name: "Corners" }).tap();
	await expect(reopened.getByRole("radio", { name: /Square/u })).toBeChecked();
	await reopened.getByRole("button", { name: "Cancel" }).tap();
	await reopened.getByRole("button", { name: "Colors" }).tap();
	await expect(reopened.getByLabel("Primary", { exact: true })).not.toHaveValue(originalPrimary);
});

test("drops the sheet to a peek to preview the site and brings it back up", async ({ page }) => {
	await openWebsiteEditor(page);
	const sheet = await openEditorSheet(page);
	await sheet.getByRole("button", { name: "Colors" }).tap();
	await expectSheetPeeksOnSelect(sheet, { option: sheet.getByRole("radio", { name: "Palette 2" }), panel: "Colors" });
	await sheet.getByRole("button", { name: "Cancel" }).tap();
	await expect(sheet.getByRole("tab", { name: "Design" })).toBeVisible();
});

test("applies a theme from the bottom sheet", async ({ page }) => {
	await openWebsiteEditor(page);
	const sheet = await openEditorSheet(page);
	await sheet.getByRole("button", { name: "Themes" }).tap();
	await tapRadioCard(sheet.getByRole("radiogroup", { name: "Themes" }), /^Clay Cool/u);
	const restyle = page.waitForResponse((response) => response.url().includes("/websites/restyleTemplate"));
	await sheet.getByRole("button", { name: "Done" }).tap();
	expect((await restyle).status()).toBe(200);
	await expect(sheet.getByRole("button", { name: "Themes" })).toBeVisible();
	await expectNoHorizontalOverflow(page);
});

test("opens the media library for an image and the agent tab inside the sheet", async ({ page }) => {
	const heading = await openWebsiteEditor(page);
	await heading.tap();
	await heroControls(page).getByRole("button", { name: "Media" }).tap();
	const sheet = page.getByRole("dialog", { name: "Customize" });
	await expect(sheet.getByRole("heading", { name: "Media library" })).toBeVisible();
	await sheet.getByRole("button", { name: "Back" }).tap();
	await expect(sheet.getByRole("button", { name: "Themes" })).toBeVisible();

	await sheet.getByRole("tab", { name: "Agent" }).tap();
	const prompt = sheet.getByRole("textbox", { name: "Write your prompt" });
	await expectInViewport(prompt);
	await sheet.getByRole("tab", { name: "Design" }).tap();
	await closeEditorSheet(sheet);
});

test("edits a header link and opens site settings from the sheet", async ({ page }) => {
	await openWebsiteEditor(page);
	await page.getByRole("combobox", { name: "Language: English" }).tap();
	await page.getByRole("option", { name: /Arabic/u }).tap();
	await page.getByRole("button", { name: "احجز الآن" }).first().tap();
	const link = page.getByRole("dialog", { name: "Link destination" });
	await expect(link).toBeVisible();
	await link.getByRole("combobox", { name: "Link type" }).tap();
	await page.getByRole("option", { name: "External URL" }).tap();
	await link.getByRole("textbox", { name: "Destination" }).fill("https://example.com/book");
	const save = link.getByRole("button", { name: "Save link" });
	await expectInViewport(save);
	const saved = websiteEdit(page);
	await save.tap();
	await saved;
	await expect(link).toBeHidden();

	const sheet = await openEditorSheet(page);
	await sheet.getByRole("button", { name: "Site settings" }).tap();
	const settings = page.getByRole("dialog", { name: "Site settings" });
	await expect(settings).toBeVisible();
	await expect(sheet).toBeHidden();

	for (const section of ["Domains", "Pages & SEO", "Languages", "Integrations"]) {
		await settings.getByRole("button", { exact: true, name: section }).tap();
		await settings.getByRole("button", { exact: true, name: "Site settings" }).tap();
	}

	await settings.getByRole("button", { exact: true, name: "Close" }).tap();
	await expect(settings).toBeHidden();
});

test("publishes the website from the publish panel", async ({ page }) => {
	await openWebsiteEditor(page);
	await page.getByRole("button", { name: "Open publish panel" }).tap();
	const publish = page.getByRole("dialog", { name: "Publish your site" });
	await expect(publish).toBeVisible();
	const action = publish.getByRole("button", { name: "Publish website" });
	await expectInViewport(action);
	await action.tap();
	await expect(page.getByText("Website published")).toBeVisible();
	await expect(page.getByRole("button", { name: "Open publish panel" })).toContainText("");
	await page.getByRole("button", { name: "Open publish panel" }).tap();
	await expect(publish.getByRole("button", { name: "Up to date" })).toBeDisabled();
});
