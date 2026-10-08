import { test } from "@e2e-dev/web";
import { expect } from "e2e";

import { deleteUserByEmail, issueSignInOTP } from "../fixtures/auth";
import { workspaceEmail } from "../fixtures/workspace";

test.setup(
	"a workspace owner signs in and onboards on a phone",
	{ sessions: ["owner"] },
	async ({ app, browser, screen, session }) => {
		await deleteUserByEmail(workspaceEmail);

		await app.open("/login");
		await screen.getByRole("button", "Continue with Email").tap();
		await screen.getByRole("textbox", "Email address").fill(workspaceEmail);
		await screen.getByRole("button", "Continue").tap();
		const code = screen.getByRole("textbox", "Enter verification code");
		await expect(code).toBeVisible();
		await code.fill(await issueSignInOTP(workspaceEmail));
		await screen.getByRole("button", "Verify").tap();
		await expect(browser).toHaveURL(/\/onboarding$/u, { timeout: 60_000 });

		await screen.getByRole("textbox", "What’s your business called?").fill("Northstar Studio");
		await screen.getByRole("button", "Create workspace").tap();
		await expect(browser).toHaveURL(/\/dashboard$/u, { timeout: 90_000 });
		await session.save("owner");
	}
);
