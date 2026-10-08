import { expect, test, type Route } from "@playwright/test";

const approval = { id: "run-1::call-1" };

const input = { revision: "revision-1" };

const toolCall = { input, toolCallId: "call-1", type: "tool-publishBrand" as const };

const userMessage = { id: "user-1", parts: [{ text: "Publish my brand", type: "text" }], role: "user" };

const pendingMessage = {
	id: "assistant-1",
	parts: [{ ...toolCall, approval, state: "approval-requested" }],
	role: "assistant",
};

const stream = (chunks: Array<object>) => ({
	body: `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`,
	contentType: "text/event-stream",
	headers: { "cache-control": "no-cache", "x-vercel-ai-ui-message-stream": "v1" },
	status: 200,
});

const requestApproval = (route: Route) =>
	route.fulfill(
		stream([
			{ messageId: "assistant-1", type: "start" },
			{ input, toolCallId: "call-1", toolName: "publishBrand", type: "tool-input-available" },
			{ approvalId: approval.id, toolCallId: "call-1", type: "tool-approval-request" },
			{ type: "finish" },
		])
	);

test("recovers an approval card without a refresh after the server rejects the continuation", async ({ page }) => {
	const posts: Array<unknown> = [];

	await page.route("**/api/chats/*/stream", async (route) => {
		if (route.request().method() !== "POST") {
			await route.fulfill({ status: 204 });

			return;
		}

		posts.push(route.request().postDataJSON());

		if (posts.length === 1) {
			await requestApproval(route);
		} else if (posts.length === 2) {
			await route.fulfill({
				json: { error: { message: "Assistant continuation does not match the pending request." } },
				status: 400,
			});
		} else {
			await route.fulfill(
				stream([
					{ messageId: "assistant-1", type: "start" },
					{ output: { revision: "revision-2" }, toolCallId: "call-1", type: "tool-output-available" },
					{ id: "text", type: "text-start" },
					{ delta: "Brand published.", id: "text", type: "text-delta" },
					{ id: "text", type: "text-end" },
					{ type: "finish" },
				])
			);
		}
	});
	await page.route("**/api/rpc/chats/messages", (route) =>
		route.fulfill({ json: { json: [userMessage, pendingMessage], meta: [] } })
	);

	await page.goto("/dashboard");
	await page.getByRole("textbox", { name: "Write your prompt" }).fill("Publish my brand");
	await page.getByRole("button", { name: "Send" }).click();

	const apply = page.getByRole("button", { name: "Apply change" });
	await apply.click();

	await expect(
		page.getByText("The request changed before your answer arrived. Review it and try again.")
	).toBeVisible();
	await expect(page.getByText("Assistant continuation does not match")).toHaveCount(0);
	await expect(apply).toBeVisible();

	await apply.click();
	await expect(page.getByText("Brand published.")).toBeVisible();
	expect(posts).toHaveLength(3);
	expect(posts[2]).toMatchObject({
		message: { parts: [{ approval: { approved: true, id: approval.id }, state: "approval-responded" }] },
	});
});
