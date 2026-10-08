import { expect, test } from "@playwright/test";

import { generatedWebsiteBrief, seedGeneratedWebsite } from "./fixtures/website";

type MutableReference<Value> = { value: Value };

test("generates and renders a bilingual website from a brief", async ({ page }) => {
	const submittedInputReference: MutableReference<unknown | undefined> = { value: undefined };

	await page.route("**/api/rpc/websites/generate", async (route) => {
		submittedInputReference.value = route.request().postDataJSON();
		const result = await seedGeneratedWebsite();
		await route.fulfill({ json: result });
	});

	await page.route("**/api/rpc/websites/streamWorkflow**", async (route) => {
		await route.fulfill({
			json: {
				code: "NOT_FOUND",
				defined: false,
				inferable: false,
				message: "Workflow completed",
			},
			status: 404,
		});
	});

	await page.goto("/dashboard/website");

	await page.getByRole("button", { name: "Business details" }).click();
	const name = page.getByRole("textbox", { name: "What’s your business called?" });
	await name.fill(generatedWebsiteBrief.name);
	await page.getByRole("button", { exact: true, name: "Continue" }).click();
	await page.getByRole("textbox", { name: "Where is your business based?" }).fill(generatedWebsiteBrief.location);
	await page.getByRole("button", { exact: true, name: "Continue" }).click();
	await page.getByRole("textbox", { name: "What does your business do?" }).fill(generatedWebsiteBrief.type);
	await page.getByRole("button", { name: "Generate website & Links" }).click();

	await expect
		.poll(() => submittedInputReference.value, { timeout: 30_000 })
		.toEqual({ json: { brief: generatedWebsiteBrief } });
	await expect(page.getByRole("button", { name: "Book your session" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Open publish panel" })).toBeVisible();

	await page.getByRole("combobox", { name: "Language: English" }).click();
	await page.getByRole("option", { name: "Arabic" }).click();

	await expect
		.poll(() =>
			page
				.getByRole("textbox", { name: "Edit website text" })
				.evaluateAll((elements) =>
					elements.map((element) =>
						element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
							? element.value
							: element.textContent
					)
				)
		)
		.toContain("ساونا متنقلة وحوض بارد — تصلك إلى بابك");

	await page.getByRole("tab", { name: "Design" }).click();
	await page.getByRole("button", { exact: true, name: "Themes" }).click();
	const theme = page.getByRole("radio", { name: /^Clay Cool/u });
	await theme.focus();
	await theme.press("Space");
	await expect(theme).toBeChecked();
	await expect(page.getByText(/All content is preserved\./u)).toBeVisible();
	const restyle = page.waitForResponse((response) => response.url().includes("/websites/restyleTemplate"));
	await page.getByRole("button", { exact: true, name: "Done" }).click();
	expect((await restyle).status()).toBe(200);
	await expect(page.getByRole("button", { exact: true, name: "Themes" })).toBeVisible();
	await page.reload();
	await expect(page.getByRole("button", { name: "Book your session" })).toBeVisible();
	await page.screenshot({ fullPage: true, path: "test-results/website-preserved-restyle.png" });
});
