import { beforeEach, describe, test } from "@e2e-dev/web";
import { expect } from "e2e";

describe("managing the business from a phone", { session: "owner" }, () => {
	beforeEach(async ({ app, screen }) => {
		await app.open("/dashboard");
		await expect(screen.getByRole("button", "Toggle navigation")).toBeVisible();
	});

	test("opens the team settings from the menu", async ({ agent, screen }) => {
		await agent.act("open Settings from the navigation menu and show the Team settings");
		const settings = screen.getByRole("dialog", "Settings");
		await expect(settings).toBeVisible();
		await expect(settings.getByRole("button", "Settings")).toBeVisible();
	});
});
