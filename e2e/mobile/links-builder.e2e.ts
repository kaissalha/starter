import { beforeEach, describe, test } from "@e2e-dev/web";
import { expect } from "e2e";

import { readWorkspaceLinkPage, resetWorkspaceWebsite } from "../fixtures/workspace";

const blocks = "[data-links-block-id]";

describe("building the Links page on a phone", { session: "owner" }, () => {
	beforeEach(async ({ app, browser, screen }) => {
		await resetWorkspaceWebsite();
		await browser.route("**/api/rpc/linkPreviews/get**", (route) => route.fulfill({ status: 500 }));
		await app.open("/dashboard/links");
		await expect(screen.getByRole("button", "Open publish panel")).toBeVisible();
		await expect(browser.locator(blocks)).toHaveCount(1);
	});

	test("adds a link and puts it first", async ({ agent, browser }) => {
		await agent.act("add a link to {url}", { params: { url: "https://example.com/menu" } });
		await expect(browser.locator(blocks)).toHaveCount(2);
		await expect(browser.locator(blocks).last()).toContainText("example.com");
		await agent.act("move the example.com link above the Website link");
		await expect(browser.locator(blocks).first()).toContainText("example.com");
		await expect
			.poll(async () => JSON.stringify((await readWorkspaceLinkPage())?.document.blocks[0]))
			.toContain("https://example.com/menu");
	});

	test("restyles the buttons and keeps the link visible above the sheet", async ({ agent, screen }) => {
		await agent.act("in the Customize sheet, change the button style to Outline and save");
		const sheet = screen.getByRole("dialog", "Customize");
		await expect(sheet.getByRole("button", "Buttons")).toBeVisible();
		await expect(sheet.getByText("Outline")).toBeVisible();
		await agent.act("open the Buttons panel in the Customize sheet");
		await expect(sheet.getByRole("button", "Outline")).toBeVisible();
		await agent.assert("a link button from the page preview is visible above the Customize sheet", {
			vision: "only",
		});
	});

	test("adds an Instagram social icon", async ({ agent, browser }) => {
		await agent.act("add a social icons section with an Instagram profile at {url}", {
			params: { url: "https://instagram.com/northstarstudio" },
		});
		await expect(browser.locator("[aria-label=Instagram]").first()).toBeAttached();
		await expect
			.poll(async () => JSON.stringify((await readWorkspaceLinkPage())?.document.blocks))
			.toContain("instagram.com/northstarstudio");
	});

	test("publishes the Links page", async ({ agent, screen }) => {
		await agent.act("publish the Links page");
		await expect(screen.getByText("Links page published")).toBeVisible();
		await expect.poll(async () => Boolean((await readWorkspaceLinkPage())?.publishedAt)).toBe(true);
	});
});
