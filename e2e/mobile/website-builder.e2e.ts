import { beforeEach, describe, test } from "@e2e-dev/web";
import { expect } from "e2e";

import { readWorkspaceWebsiteDraft, resetWorkspaceWebsite } from "../fixtures/workspace";

const pageSections = "[data-website-section-id][data-area=page]";

describe("building the website on a phone", { session: "owner" }, () => {
	beforeEach(async ({ app, screen }) => {
		await resetWorkspaceWebsite();
		await app.open("/dashboard/website");
		await expect(screen.getByRole("button", "Open publish panel")).toBeVisible();
	});

	test("the editor header fits the phone and the preview stays visible while customizing", async ({
		agent,
		screen,
	}) => {
		await agent.assert("every control in the top header bar is fully visible and none of them overlap", {
			vision: "only",
		});
		await agent.act("open the Customize sheet");
		await expect(screen.getByRole("dialog", "Customize")).toBeVisible();
		await agent.assert("the website preview is still visible above the Customize sheet", { vision: "only" });
	});

	test("changes the corner style from the Customize sheet and keeps it after saving", async ({ agent, screen }) => {
		await agent.act("in the Customize sheet, change the website corners to Square and save");
		await expect(screen.getByRole("dialog", "Customize").getByRole("button", "Corners")).toBeVisible();
		await expect.poll(async () => (await readWorkspaceWebsiteDraft())?.brand.corners.style).toBe("square");
	});

	test("edits the Arabic hero heading in place", async ({ agent, screen }) => {
		const heading = "ساونا على عجلات";
		await agent.act("switch the website language to Arabic");
		await expect(screen.getByRole("combobox", "Language: Arabic")).toBeVisible();
		await agent.act("replace the first heading on the page with {heading}", { params: { heading } });
		await expect(screen.getByText(heading)).toBeVisible();
		await expect
			.poll(async () => JSON.stringify((await readWorkspaceWebsiteDraft())?.content.ar))
			.toContain(heading);
	});

	test("moves and deletes sections with the section controls", async ({ agent, browser, screen }) => {
		await agent.act("move the first section of the page below the section after it");
		await expect(browser.locator(pageSections).first()).not.toContainText("Mobile Sauna");
		await agent.act("delete the section titled {title}, confirming the deletion", {
			params: { title: "Recover like a Nordic athlete" },
		});
		await expect(screen.getByText("Recover like a Nordic athlete")).toHaveCount(0);
	});

	test("publishes the website", async ({ agent, screen }) => {
		await agent.act("publish the website");
		await expect(screen.getByText("Website published")).toBeVisible();
	});
});
