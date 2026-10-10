import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow, openNavigation } from "../fixtures/mobile";

test("reaches the dashboard home from the navigation drawer without horizontal overflow", async ({ page }) => {
	await page.goto("/dashboard");
	const navigation = await openNavigation(page);
	await navigation.getByRole("link", { exact: true, name: "Home" }).tap();
	await expect(page).toHaveURL(/\/dashboard$/u, { timeout: 30_000 });
	await expect(navigation).toBeHidden();
	await expect(page.getByRole("button", { name: "Toggle navigation" }).first()).toBeVisible();
	await expectNoHorizontalOverflow(page);
});

test("shows the logo and a close button in the navigation drawer", async ({ page }) => {
	await page.goto("/dashboard");
	const navigation = await openNavigation(page);
	await expect(navigation.getByRole("button", { exact: true, name: "Close" })).toBeVisible();
	await navigation.getByRole("button", { exact: true, name: "Close" }).tap();
	await expect(navigation).toBeHidden();
});

test("switches the dashboard language and theme from the drawer", async ({ page }) => {
	await page.goto("/dashboard");
	const english = await openNavigation(page);
	await english.getByRole("button", { name: "Language: English" }).tap();
	await page.getByRole("menuitemradio", { name: "Arabic" }).tap();
	await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
	await expect(page).toHaveURL(/\/ar\/dashboard$/u);
	await expectNoHorizontalOverflow(page);
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await page.getByRole("banner").getByRole("button", { name: "فتح قائمة التنقل أو إغلاقها" }).tap();
	const arabic = page.getByRole("dialog", { name: "التنقل" });
	await arabic.getByRole("button", { name: "اللغة: العربية" }).tap();
	await page.getByRole("menuitemradio", { name: "الإنجليزية" }).tap();
	await expect(page).toHaveURL(/localhost:3100\/dashboard$/u);
	await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
	await expect(page.getByRole("dialog")).toHaveCount(0);

	const dark = await openNavigation(page);
	await dark.getByRole("button", { name: /^Theme: /u }).tap();
	await page.getByRole("menuitemradio", { name: "Dark" }).tap();
	await expect(page.locator("html")).toHaveClass(/dark/u);
	await dark.getByRole("button", { name: "Theme: Dark" }).tap();
	await page.getByRole("menuitemradio", { name: "System" }).tap();
	await expect(page.locator("html")).not.toHaveClass(/dark/u);
});

test("opens every settings tab in the bottom sheet and closes it", async ({ page }) => {
	await page.goto("/dashboard");
	const navigation = await openNavigation(page);
	await navigation.getByRole("button", { exact: true, name: "Settings" }).tap();
	const settings = page.getByRole("dialog", { name: "Settings" });
	await expect(settings).toBeVisible();

	for (const tab of ["General", "Workspace", "Team", "Notifications", "Developers"]) {
		await settings.getByRole("button", { exact: true, name: tab }).tap();
		await expect(settings.getByRole("button", { exact: true, name: "Settings" })).toBeVisible();
		await expectNoHorizontalOverflow(page);
		await settings.getByRole("button", { exact: true, name: "Settings" }).tap();
	}

	await settings.getByRole("button", { exact: true, name: "Close" }).tap();
	await expect(settings).toBeHidden();
});

test("opens notifications from the navigation drawer", async ({ page }) => {
	await page.goto("/dashboard");
	const navigation = await openNavigation(page);
	await navigation.getByRole("button", { exact: true, name: "Notifications" }).tap();
	await expect(page.getByRole("tab", { name: "Inbox" })).toBeVisible();
	await page.getByRole("tab", { name: "Archive" }).tap();
	await expect(page.getByText("Nothing in the archive")).toBeVisible();
});
