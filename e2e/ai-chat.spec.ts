import { expect, test } from "@playwright/test";

import { mockChatStream } from "./fixtures/chat";

const prompt = "Give me one concise launch idea.";

const answer = "Launch with a focused customer story and one measurable call to action.";

test("sends a chat message and renders the streamed assistant response", async ({ page }) => {
	const submitted = await mockChatStream({ answer, page });

	await page.goto("/dashboard");
	await page.getByRole("textbox", { name: "Write your prompt" }).fill(prompt);
	await page.getByRole("button", { name: "Send" }).click();

	await expect(page.getByText(prompt, { exact: true })).toBeVisible();
	await expect(page.getByText(answer, { exact: true })).toBeVisible();

	await expect
		.poll(() => submitted[0])
		.toMatchObject({
			message: {
				parts: [{ text: prompt, type: "text" }],
				role: "user",
			},
		});
});
