import { test } from "@e2e-dev/web";
import { expect } from "e2e";

import { deleteUserByEmail, issueSignInOTP } from "../fixtures/auth";
import { seedGeneratedWebsite } from "../fixtures/website";
import { workspaceEmail } from "../fixtures/workspace";

const answers = [
	["What’s your business called?", "Northstar Studio"],
	["Where is your business based?", "Vancouver, Canada"],
	["What does your business do?", "Interior design studio"],
] as const;

test.setup(
	"a workspace owner signs in and onboards on a phone",
	{ sessions: ["owner"] },
	async ({ app, browser, screen, session }) => {
		await deleteUserByEmail(workspaceEmail);
		await browser.route("**/api/rpc/websites/generate", async (route) => {
			await route.fulfill({ json: { json: await seedGeneratedWebsite() } });
		});

		await app.open("/login");
		await screen.getByRole("button", "Continue with Email").tap();
		await screen.getByRole("textbox", "Email address").fill(workspaceEmail);
		await screen.getByRole("button", "Continue").tap();
		const code = screen.getByRole("textbox", "Enter verification code");
		await expect(code).toBeVisible();
		await code.fill(await issueSignInOTP(workspaceEmail));
		await screen.getByRole("button", "Verify").tap();
		await expect(browser).toHaveURL(/\/onboarding$/u, { timeout: 60_000 });

		for (const [index, [label, answer]] of answers.entries()) {
			await screen.getByRole("textbox", label).fill(answer);
			await screen
				.getByRole("button", index < answers.length - 1 ? "Continue" : "Generate website & Links")
				.tap();
		}

		await expect(browser).toHaveURL(/\/dashboard\/website$/u, { timeout: 90_000 });
		await session.save("owner");
	}
);
