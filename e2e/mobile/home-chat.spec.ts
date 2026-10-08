import { expect, test } from "@playwright/test";

import { mockChatStream } from "../fixtures/chat";
import { expectInViewport } from "../fixtures/mobile";
import { resetWorkspaceWebsite } from "../fixtures/workspace";

test.beforeEach(async () => {
	await resetWorkspaceWebsite();
});

test("composes a multi-line prompt on a touch keyboard and sends it with the button", async ({ page }) => {
	const answer = "Offer a sunrise sauna session for early risers.";
	const submitted = await mockChatStream({ answer, page });
	await page.goto("/dashboard");
	const prompt = page.getByRole("textbox", { name: "Write your prompt" });
	await expect(prompt).toBeVisible();
	await expect(prompt).not.toBeFocused();

	await prompt.tap();
	await prompt.pressSequentially("One idea");
	await prompt.press("Enter");
	await prompt.pressSequentially("for mornings");
	await expect(prompt).toHaveValue("One idea\nfor mornings");
	expect(submitted).toHaveLength(0);

	const send = page.getByRole("button", { name: "Send" });
	await expectInViewport(send);
	await send.tap();
	await expect(page.getByText(answer, { exact: true })).toBeVisible();
	expect(submitted).toHaveLength(1);
});

test("opens the website editor from the home overview", async ({ page }) => {
	await page.goto("/dashboard");
	await page.getByRole("link", { name: "Edit website" }).tap();
	await expect(page).toHaveURL(/\/dashboard\/website$/u);
	await expect(page.getByRole("button", { name: "Open publish panel" })).toBeVisible();
});
