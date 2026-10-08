import { expect, type Locator, type Page } from "@playwright/test";

export const expectNoHorizontalOverflow = (page: Page) =>
	expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

export const expectInViewport = async (locator: Locator) => {
	await expect(locator).toBeInViewport({ ratio: 1 });
};

export const expectHeaderControlsFit = async (page: Page) => {
	const header = page.getByRole("banner").first();
	await expect(header).toBeVisible();

	const boxes = await header
		.locator("button:visible, [role=combobox]:visible, [role=switch]:visible, a:visible")
		.evaluateAll((elements) =>
			elements
				.map((element) => element.getBoundingClientRect())
				.filter((rect) => rect.width > 1 && rect.height > 1)
				.map(({ bottom, left, right, top }) => ({ bottom, left, right, top }))
		);

	const width = page.viewportSize()?.width ?? 0;

	expect(boxes.length).toBeGreaterThan(0);

	for (const box of boxes) {
		expect(box.left).toBeGreaterThanOrEqual(0);
		expect(box.right).toBeLessThanOrEqual(width);
	}

	const overlaps = boxes.filter((box, index) =>
		boxes
			.slice(index + 1)
			.some(
				(other) =>
					box.left < other.right - 1 &&
					other.left < box.right - 1 &&
					box.top < other.bottom - 1 &&
					other.top < box.bottom - 1
			)
	);

	expect(overlaps).toEqual([]);
};

export const openEditorSheet = async (page: Page) => {
	await page.getByRole("banner").getByRole("button", { name: "Customize" }).tap();
	const sheet = page.getByRole("dialog", { name: "Customize" });
	await expect(sheet).toBeVisible();

	return sheet;
};

export const closeEditorSheet = async (sheet: Locator) => {
	await sheet.getByRole("button", { exact: true, name: "Close" }).tap();
	await expect(sheet).toBeHidden();
};

const sheetHandle = (page: Page) =>
	page.getByRole("dialog", { name: "Customize" }).getByRole("button", { exact: true, name: "Preview" });

export const expectSheetPeeksOnSelect = async (
	sheet: Locator,
	{ option, panel }: { option: Locator; panel: string }
) => {
	const handle = sheetHandle(sheet.page());
	const done = sheet.getByRole("button", { name: "Done" });
	await expect(sheet.getByRole("tab", { name: "Design" })).toBeHidden();
	await option.locator("xpath=ancestor-or-self::label[1]").tap();
	await expect(handle).toHaveAttribute("aria-expanded", "false");
	await expect(done).not.toBeInViewport();
	await expectInViewport(sheet.getByRole("heading", { name: panel }));
	await sheet.getByRole("heading", { name: panel }).tap();
	await expect(handle).toHaveAttribute("aria-expanded", "true");
	await expectInViewport(done);
	await handle.tap();
	await expect(handle).toHaveAttribute("aria-expanded", "false");
	await handle.tap();
	await expectInViewport(done);
};

export const openNavigation = async (page: Page) => {
	await page.getByRole("banner").getByRole("button", { name: "Toggle navigation" }).tap();
	const navigation = page.getByRole("dialog", { name: "Navigation" });
	await expect(navigation).toBeVisible();

	return navigation;
};

export const tapRadioCard = async (scope: Locator, name: string | RegExp) => {
	const radio = scope.getByRole("radio", { name });
	await radio.locator("xpath=ancestor::label[1]").tap();
	await expect(radio).toBeChecked();
	const handle = sheetHandle(scope.page());

	if ((await handle.count()) > 0 && (await handle.getAttribute("aria-expanded")) === "false") {
		await handle.tap();
		await expect(handle).toHaveAttribute("aria-expanded", "true");
	}
};
