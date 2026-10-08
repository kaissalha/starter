import { expect, test, type Page } from "@playwright/test";

const publicWebsiteURL = "http://018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339.localhost:3101";

const outputFor = (page: Page, label: string) =>
	page.locator("output").filter({ has: page.getByText(label, { exact: true }) });

const hydrationErrors = (page: Page) => {
	const errors: Array<string> = [];

	page.on("console", (message) => {
		if (message.type() === "error" && /hydration|did not match/u.test(message.text().toLowerCase())) {
			errors.push(message.text());
		}
	});

	return errors;
};

test("hydrates persisted CEL and QuickJS sections with keyboard-accessible behavior", async ({ page }) => {
	await page.setViewportSize({ height: 900, width: 1280 });
	const consoleErrors = hydrationErrors(page);

	await page.goto(publicWebsiteURL);

	await expect(page.getByRole("heading", { level: 2, name: "CEL calculator" })).toBeVisible();
	await expect(outputFor(page, "Exact total")).toContainText("0.3");

	const amount = page.getByRole("textbox", { name: "Base amount" });
	await amount.fill("-");
	await expect(amount).toHaveAttribute("aria-invalid", "true");
	await expect(page.getByRole("alert").filter({ hasText: "Enter a valid decimal" })).toHaveText(
		"Enter a valid decimal"
	);
	await expect(outputFor(page, "Exact total")).toContainText("0.3");

	await amount.fill("1.5");
	await expect(amount).toHaveAttribute("aria-invalid", "false");
	await expect(outputFor(page, "Exact total")).toContainText("1.7");

	await expect(page.getByRole("heading", { level: 2, name: "QuickJS calculator" })).toBeVisible();
	await expect(outputFor(page, "Doubled")).toContainText("6");
	await page.getByRole("textbox", { name: "Count" }).fill("4");
	await expect(outputFor(page, "Doubled")).toContainText("8");

	const trigger = page.getByRole("button", { name: "Jump to details" });
	await trigger.focus();
	await expect(trigger).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("heading", { level: 2, name: "Recover like a Nordic athlete" })).toBeInViewport();

	const layout = await page.getByRole("heading", { level: 2, name: "CEL calculator" }).evaluate((heading) => {
		const grid = heading.closest(".iw-grid");
		const surface = heading.closest(".website-container");

		return {
			direction: surface ? getComputedStyle(surface).direction : null,
			gridTemplateColumns: grid ? getComputedStyle(grid).gridTemplateColumns : null,
		};
	});

	expect(layout.direction).toBe("ltr");
	expect(layout.gridTemplateColumns).not.toBe("none");
	expect(consoleErrors).toEqual([]);
});

test("localizes custom behavior and layout for Arabic RTL", async ({ page }) => {
	await page.setViewportSize({ height: 844, width: 390 });
	const consoleErrors = hydrationErrors(page);

	await page.goto(`${publicWebsiteURL}/ar`);

	await expect(page.locator("html")).toHaveAttribute("lang", "ar");
	await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
	await expect(page.getByRole("heading", { level: 2, name: "حاسبة CEL" })).toBeVisible();

	const formatted = await page.evaluate(() => ({
		doubled: new Intl.NumberFormat("ar").format(8),
		total: new Intl.NumberFormat("ar").format(1.7),
	}));

	const amount = page.getByRole("textbox", { name: "المبلغ الأساسي" });
	await amount.fill("١٫٥");
	await expect(outputFor(page, "الإجمالي")).toContainText(formatted.total);

	await page.getByRole("textbox", { name: "العدد" }).fill("٤");
	await expect(outputFor(page, "الضعف")).toContainText(formatted.doubled);
	await expect(page.getByRole("button", { name: "انتقل إلى التفاصيل" })).toBeVisible();

	const direction = await page
		.getByRole("heading", { level: 2, name: "حاسبة CEL" })
		.evaluate((heading) => getComputedStyle(heading).direction);

	expect(direction).toBe("rtl");
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	expect(consoleErrors).toEqual([]);
});
