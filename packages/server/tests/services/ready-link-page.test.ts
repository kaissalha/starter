import { afterEach, expect, it, vi } from "vitest";

vi.mock("@starter/db", () => ({ db: {}, linkPages: {}, websites: {} }));

vi.mock("../../src/mastra/models", () => {
	throw new Error("Public Links readers must not load AI models");
});

afterEach(() => vi.unstubAllEnvs());

it("loads the public Links entrypoint without AI Gateway credentials or models", async () => {
	vi.stubEnv("AI_GATEWAY_API_KEY", undefined);
	const { getPublishedLinkPageTimestamp, getReadyLinkPage } = await import("@starter/server/link-pages");

	await expect(getPublishedLinkPageTimestamp({ websiteId: "invalid" })).resolves.toBeNull();
	await expect(getReadyLinkPage({ websiteId: "invalid" })).resolves.toBeNull();
});
