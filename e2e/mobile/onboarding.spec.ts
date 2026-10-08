import { expect, test, type Page } from "@playwright/test";

import { deleteUserByEmail, issueSignInOTP } from "../fixtures/auth";
import { expectInViewport, expectNoHorizontalOverflow } from "../fixtures/mobile";

const email = "mobile-onboarding@example.com";

test.use({ storageState: { cookies: [], origins: [] } });

const fontSize = (page: Page, name: string) =>
	page.getByRole("textbox", { name }).evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));

test("signs up and answers onboarding on a phone without dropping the keyboard between steps", async ({ page }) => {
	await deleteUserByEmail(email);
	await page.route("**/api/rpc/websites/generate", (route) =>
		route.fulfill({ json: { json: { websiteId: crypto.randomUUID(), workflowRunId: "mobile-onboarding" } } })
	);

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

	const answers = [
		["What’s your business called?", "Harbour Bakery"],
		["Where is your business based?", "Halifax, Canada"],
		["What does your business do?", "Neighbourhood bakery"],
	] as const;

	const field = page.getByRole("textbox", { name: answers[0][0] });
	await expect(field).toBeFocused();
	await field.evaluate((element) => element.setAttribute("data-e2e-field", ""));
	expect(await fontSize(page, answers[0][0])).toBeGreaterThanOrEqual(16);

	for (const [index, [label, answer]] of answers.entries()) {
		const input = page.getByRole("textbox", { name: label });
		await expect(input).toBeFocused();
		await expect(input).toHaveAttribute("data-e2e-field", "");
		await expect(input).toHaveAttribute("enterkeyhint", index < answers.length - 1 ? "next" : "go");
		await input.fill(answer);

		if (index < answers.length - 1) {
			await input.press("Enter");
		}
	}

	const generate = page.getByRole("button", { name: "Generate website & Links" });
	await expectInViewport(generate);
	await generate.tap();
	await expect(page).toHaveURL(/\/dashboard\/website$/u, { timeout: 60_000 });
	await deleteUserByEmail(email);
});
