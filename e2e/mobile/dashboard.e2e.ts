import { beforeEach, describe, test } from "@e2e-dev/web";
import { expect } from "e2e";

import { resetWorkspaceRecords } from "../fixtures/workspace";

describe("managing the business from a phone", { session: "owner" }, () => {
	beforeEach(async ({ app, screen }) => {
		await resetWorkspaceRecords();
		await app.open("/dashboard");
		await expect(screen.getByRole("button", "Toggle navigation")).toBeVisible();
	});

	test("navigates with the menu and adds a contact", async ({ agent, browser, screen }) => {
		await agent.act("go to Contacts using the navigation menu");
		await expect(browser).toHaveURL(/\/dashboard\/contacts$/u);
		await agent.act("add a contact named {name} with the email {email}", {
			params: { email: "maya@example.com", name: "Maya Lind" },
		});
		await expect(screen.getByText("maya@example.com").first()).toBeVisible();
		const width = await browser.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
		expect(width).toBeLessThanOrEqual(0);
	});

	test("starts a blank blog post", async ({ agent, browser, screen }) => {
		await agent.act("go to the Blog using the navigation menu");
		await expect(browser).toHaveURL(/\/dashboard\/blog$/u);
		await agent.act("start a blank draft");
		await expect(browser).toHaveURL(/\/dashboard\/blog\/[\da-f-]+$/u, { timeout: 30_000 });
		const title = screen.getByRole("textbox", "Title");
		await title.fill("Winter sauna tips");
		await expect(title).toHaveText("Winter sauna tips");
	});

	test("opens the team settings from the menu", async ({ agent, screen }) => {
		await agent.act("open Settings from the navigation menu and show the Team settings");
		const settings = screen.getByRole("dialog", "Settings");
		await expect(settings).toBeVisible();
		await expect(settings.getByRole("button", "Settings")).toBeVisible();
	});
});
