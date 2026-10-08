import { expect, test, type Page } from "@playwright/test";

import { deleteUserByEmail, issueSignInOTP } from "../fixtures/auth";
import { expectInViewport, expectNoHorizontalOverflow } from "../fixtures/mobile";

const email = "mobile-onboarding@example.com";

test.use({ storageState: { cookies: [], origins: [] } });

const fontSize = (page: Page, name: string) =>
	page.getByRole("textbox", { name }).evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));

test("signs up and creates a workspace on a phone", async ({ page }) => {
	await deleteUserByEmail(email);

	await page.goto("/login");
	await expectNoHorizontalOverflow(page);
	await page.getByRole("button", { name: "Continue with Email" }).tap();
	expect(await fontSize(page, "Email address")).toBeGreaterThanOrEqual(16);
	await page.getByRole("textbox", { name: "Email address" }).fill(email);
	await page.getByRole("button", { exact: true, name: "Continue" }).tap();
	const code = page.getByRole("textbox", { name: "Enter verification code" });
	await expect(code).toBeVisible();
	await code.fill(await issueSignInOTP(email));
	await page.getByRole("button", { exact: true, name: "Verify" }).tap();
	await expect(page).toHaveURL(/\/onboarding/u, { timeout: 60_000 });

	const label = "What’s your business called?";
	const field = page.getByRole("textbox", { name: label });
	await expect(field).toBeFocused();
	await expect(field).toHaveAttribute("enterkeyhint", "go");
	expect(await fontSize(page, label)).toBeGreaterThanOrEqual(16);
	await field.fill("Harbour Bakery");

	const create = page.getByRole("button", { name: "Create workspace" });
	await expectInViewport(create);
	await create.tap();
	await expect(page).toHaveURL(/\/dashboard$/u, { timeout: 60_000 });
	await deleteUserByEmail(email);
});
