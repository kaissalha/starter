import type { Page } from "@playwright/test";

export const mockChatStream = async ({ answer, page }: { answer: string; page: Page }) => {
	const submitted: Array<unknown> = [];

	await page.route("**/api/chats/*/stream", async (route) => {
		if (route.request().method() !== "POST") {
			await route.fulfill({ status: 204 });

			return;
		}

		submitted.push(route.request().postDataJSON());

		const chunks = [
			{ messageId: "assistant-message", type: "start" },
			{ id: "assistant-text", type: "text-start" },
			{ delta: answer, id: "assistant-text", type: "text-delta" },
			{ id: "assistant-text", type: "text-end" },
			{ type: "finish" },
		];

		await route.fulfill({
			body: `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`,
			contentType: "text/event-stream",
			headers: {
				"cache-control": "no-cache",
				"x-vercel-ai-ui-message-stream": "v1",
			},
			status: 200,
		});
	});

	return submitted;
};
