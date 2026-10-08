import { test } from "@e2e-dev/web";
import { expect, unique } from "e2e";

import { deleteUserByEmail, issueSignInOTP } from "./fixtures/auth";

const email = "e2e-signup@example.com";

const business = { location: "Toronto, Canada", name: "Agentic Workspace", type: "Photography studio" };

test("a new user signs up with email and completes onboarding", async ({ agent, app, browser, screen }) => {
	const generationRequests: Array<unknown> = [];
	await deleteUserByEmail(email);
	await browser.route("**/api/rpc/websites/generate", async (route) => {
		generationRequests.push(JSON.parse(route.request.postData ?? "null"));
		await route.fulfill({ json: { json: { websiteId: crypto.randomUUID(), workflowRunId: "e2e-onboarding" } } });
	});

	await app.open("/en/login");
	await agent.act("continue with email as {email}", { params: { email } });
	await expect(screen.getByLabel("Enter verification code")).toBeVisible();

	await agent.act("enter the verification code {code} and verify it", {
		params: { code: unique(await issueSignInOTP(email)) },
	});
	await expect(browser).toHaveURL(/\/onboarding$/u, { timeout: 60_000 });

	await agent.act(
		"answer the onboarding steps with the business {name}, based in {location}, which is a {type}, without pressing Generate website & Links",
		{ params: business }
	);
	await screen.getByRole("button", "Generate website & Links").tap();
	await expect(browser).toHaveURL(/\/dashboard\/website$/u, { timeout: 90_000 });
	expect(generationRequests).toEqual([{ json: { brief: { ...business, schemaVersion: 1 } } }]);
});
