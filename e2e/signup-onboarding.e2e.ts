import { test } from "@e2e-dev/web";
import { expect, unique } from "e2e";

import { deleteUserByEmail, issueSignInOTP } from "./fixtures/auth";

const email = "e2e-signup@example.com";

const name = "Agentic Workspace";

test("a new user signs up with email and completes onboarding", async ({ agent, app, browser, screen }) => {
	await deleteUserByEmail(email);

	await app.open("/en/login");
	await agent.act("continue with email as {email}", { params: { email } });
	await expect(screen.getByLabel("Enter verification code")).toBeVisible();

	await agent.act("enter the verification code {code} and verify it", {
		params: { code: unique(await issueSignInOTP(email)) },
	});
	await expect(browser).toHaveURL(/\/onboarding$/u, { timeout: 60_000 });

	await agent.act("enter the business name {name} without pressing Create workspace", { params: { name } });
	await screen.getByRole("button", "Create workspace").tap();
	await expect(browser).toHaveURL(/\/dashboard$/u, { timeout: 90_000 });
});
