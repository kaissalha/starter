import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	claim: vi.fn(),
	continue: vi.fn(),
	sleep: vi.fn(async () => undefined),
}));

vi.mock("workflow", () => ({ getWorkflowMetadata: () => ({ workflowRunId: "run-1" }), sleep: mocks.sleep }));

vi.mock("../../src/services/events/executions", () => ({
	claimEventExecution: mocks.claim,
	continueEventExecution: mocks.continue,
}));

import { runEventExecutionWorkflow } from "../../src/workflows/run-event-execution";

beforeEach(() => {
	mocks.claim.mockReset();
	mocks.continue.mockReset();
	mocks.sleep.mockClear();
});

describe("runEventExecutionWorkflow", () => {
	it("exits without attempting when another run owns the execution", async () => {
		mocks.claim.mockResolvedValueOnce({ status: "done" });
		await runEventExecutionWorkflow("execution-1");
		expect(mocks.claim).toHaveBeenCalledWith({ executionId: "execution-1", runId: "run-1" });
		expect(mocks.continue).not.toHaveBeenCalled();
	});

	it("sleeps until each retry time and stops when the execution settles", async () => {
		const retryAt = Date.UTC(2026, 8, 24, 12);
		mocks.claim.mockResolvedValueOnce({ status: "run" });
		mocks.continue
			.mockResolvedValueOnce({ status: "wait", until: retryAt })
			.mockResolvedValueOnce({ status: "done" });
		await runEventExecutionWorkflow("execution-1");
		expect(mocks.continue).toHaveBeenCalledTimes(2);
		expect(mocks.sleep).toHaveBeenCalledWith(new Date(retryAt));
	});
});
