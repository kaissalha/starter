import { expect, test as setup, type Page } from "@playwright/test";

import { deleteUserByEmail, issueSignInOTP } from "./fixtures/auth";

const email = "playwright@example.com";

const authFile = "e2e/.auth/user.json";

const signInWithEmail = async ({ page }: { page: Page }) => {
	await page.goto("/login");
	await page.getByRole("button", { name: "Continue with Email" }).click();
	await page.getByRole("textbox", { name: "Email address" }).fill(email);
	await page.getByRole("button", { exact: true, name: "Continue" }).click();
	const code = page.getByRole("textbox", { name: "Enter verification code" });
	await expect(code).toBeVisible();
	await code.fill(await issueSignInOTP(email));
	await page.getByRole("button", { exact: true, name: "Verify" }).click();
};

setup.beforeEach(async () => {
	await deleteUserByEmail(email);
});

setup("signs up, onboards, signs out, and signs back in", async ({ page }) => {
	setup.setTimeout(240_000);
	await signInWithEmail({ page });
	await expect(page).toHaveURL(/\/onboarding/u, { timeout: 60_000 });

	await expect(page.getByRole("textbox", { name: "What’s your business called?" })).toBeVisible();
	await page.screenshot({ fullPage: true, path: "test-results/onboarding-desktop.png" });
	await page.setViewportSize({ height: 844, width: 390 });
	await page.goto("/ar/onboarding");
	await expect(page.getByRole("textbox", { name: "ما اسم نشاطك التجاري؟" })).toBeVisible();
	await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
	await page.screenshot({ fullPage: true, path: "test-results/onboarding-ar-mobile.png" });
	await page.goto("/en/onboarding");
	await page.getByRole("textbox", { name: "What’s your business called?" }).fill("Playwright Workspace");
	await page.screenshot({ fullPage: true, path: "test-results/onboarding-en-mobile.png" });
	await page.getByRole("button", { exact: true, name: "Create workspace" }).click();
	await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/u, { timeout: 90_000 });
	await page.setViewportSize({ height: 800, width: 1280 });

	await page.getByRole("button", { name: "Logout" }).focus();
	await page.getByRole("button", { name: "Logout" }).press("Enter");
	await expect(page).toHaveURL(/\/login$/u);

	await signInWithEmail({ page });
	await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/u, { timeout: 20_000 });
	await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();

	await page.context().storageState({ path: authFile });
});
