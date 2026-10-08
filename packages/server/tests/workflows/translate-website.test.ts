import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ bind: vi.fn(), fail: vi.fn(), links: vi.fn(), save: vi.fn(), translate: vi.fn() }));

vi.mock("../../src/workflows/translate-website/steps", () => ({
	bindWebsiteWorkflow: mocks.bind,
	markWebsiteWorkflowFailed: mocks.fail,
	saveWebsiteWorkflow: mocks.save,
	translateWebsiteContent: mocks.translate,
	translateWebsiteLinks: mocks.links,
}));

import { translateWebsiteWorkflow } from "../../src/workflows/translate-website";

const input = {
	expectedRunId: null,
	expectedUpdatedAt: "2026-09-19T00:00:00Z",
	locale: "sv" as const,
	organizationId: "org",
	userId: "user",
	websiteId: "site",
};

beforeEach(() => {
	vi.resetAllMocks();
});

it("claims the job and saves only after website and Links translation finish", async () => {
	const pending = Promise.withResolvers<void>();
	mocks.links.mockReturnValue(pending.promise);
	const completion = translateWebsiteWorkflow(input);
	await vi.waitFor(() => expect(mocks.links).toHaveBeenCalledWith(input));
	expect(mocks.save).not.toHaveBeenCalled();
	pending.resolve();
	await completion;
	expect(mocks.bind).toHaveBeenCalledWith({ ...input, kind: "translation" });
	expect(mocks.save).toHaveBeenCalledOnce();
});

it("records failure without saving incomplete translations", async () => {
	mocks.translate.mockRejectedValue(new Error("Gateway timed out"));
	await expect(translateWebsiteWorkflow(input)).rejects.toThrow("Gateway timed out");
	expect(mocks.save).not.toHaveBeenCalled();
	expect(mocks.fail).toHaveBeenCalledWith(
		expect.objectContaining({ code: "TRANSLATION_FAILED", websiteId: input.websiteId })
	);
});
