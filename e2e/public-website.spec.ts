import { expect, test } from "@playwright/test";

const publicWebsiteURL = "http://018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339.localhost:3101";

test("renders the published website responsively in English and Arabic", async ({ page }) => {
	await page.setViewportSize({ height: 844, width: 390 });
	await page.goto(publicWebsiteURL);

	await expect(page.locator("html")).toHaveAttribute("lang", "en");
	await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

	await expect(
		page.getByRole("heading", { name: "Mobile Sauna & Cold Plunge — Delivered to Your Door" })
	).toBeVisible();

	const arabicLink = page.locator('a[hreflang="ar"]');
	await expect(arabicLink).toHaveText("العربية");
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

	await arabicLink.click();
	await expect(page).toHaveURL(`${publicWebsiteURL}/ar`);
	await expect(page.locator("html")).toHaveAttribute("lang", "ar");
	await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
	await expect(page.getByRole("heading", { name: "ساونا متنقلة وحوض بارد — تصلك إلى بابك" })).toBeVisible();
	await expect(page.locator('a[hreflang="en"]')).toHaveText("English");
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

	const markdown = await page.evaluate(async () => {
		const response = await fetch(location.href, { headers: { Accept: "text/markdown" } });

		return { status: response.status, text: await response.text() };
	});

	expect(markdown.status).toBe(200);
	expect(markdown.text).toContain("ساونا متنقلة");
});
