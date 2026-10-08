import { expect, test as setup, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db, linkPages, members, users, websites } from "@starter/db";

import { deleteUserByEmail, issueSignInOTP } from "./fixtures/auth";
import { seedGeneratedWebsite } from "./fixtures/website";

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
	await page.getByRole("button", { exact: true, name: "Continue" }).click();
	await page.getByRole("textbox", { name: "Where is your business based?" }).fill("Toronto, Canada");
	await page.getByRole("button", { exact: true, name: "Continue" }).click();
	await page.getByRole("textbox", { name: "What does your business do?" }).fill("Photography studio");
	await page.screenshot({ fullPage: true, path: "test-results/onboarding-en-mobile.png" });
	await page.route("**/api/rpc/websites/generate", async (route) => {
		expect(route.request().postDataJSON()).toEqual({
			json: {
				brief: {
					location: "Toronto, Canada",
					name: "Playwright Workspace",
					schemaVersion: 1,
					type: "Photography studio",
				},
			},
		});
		await route.fulfill({ json: await seedGeneratedWebsite() });
	});
	await page.getByRole("button", { name: "Generate website & Links" }).click();
	await expect(page).toHaveURL(/\/dashboard\/website$/u, { timeout: 90_000 });
	await expect(page.getByRole("button", { name: "Open publish panel" })).toBeVisible();
	await page.goto("/dashboard/links");
	await expect(page.getByRole("button", { name: "Open publish panel" })).toBeVisible();
	await page.screenshot({ fullPage: true, path: "test-results/onboarding-generated-links.png" });

	const [membership] = await db
		.select()
		.from(members)
		.innerJoin(users, eq(members.userId, users.id))
		.where(eq(users.email, email));

	if (!membership) {
		throw new Error("Onboarding membership is missing");
	}

	const organizationId = membership.members.organizationId;
	const [links] = await db.select().from(linkPages).where(eq(linkPages.organizationId, organizationId));
	expect(links?.document.blocks.length).toBeGreaterThan(0);
	expect(links?.publishedAt).toBeNull();
	await db.delete(linkPages).where(eq(linkPages.organizationId, organizationId));
	await db.delete(websites).where(eq(websites.organizationId, organizationId));
	await page.setViewportSize({ height: 800, width: 1280 });

	await page.getByRole("button", { name: "Logout" }).focus();
	await page.getByRole("button", { name: "Logout" }).press("Enter");
	await expect(page).toHaveURL(/\/login$/u);

	await signInWithEmail({ page });
	await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/u, { timeout: 20_000 });
	await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();

	await page.context().storageState({ path: authFile });
});
