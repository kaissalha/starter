import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const streamWorkflow = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", () => ({
	client: { websites: { streamWorkflow } },
}));

import { subscribeToWebsiteWorkflow } from "@/app/[locale]/dashboard/website/generation/website-workflow-subscription";
import type { WebsiteGenerationEnvelopeV1 } from "@starter/infinite-website/contracts";

const planningEnvelope: WebsiteGenerationEnvelopeV1 = {
	cursor: "0",
	event: { eventKey: "status:planning", stage: "planning", type: "status", version: 1 },
};

const writingEnvelope: WebsiteGenerationEnvelopeV1 = {
	cursor: "1",
	event: { eventKey: "status:writing", stage: "writing", type: "status", version: 1 },
};

const subscribe = ({
	onEnded = vi.fn(),
	onEnvelope = vi.fn(),
	signal = new AbortController().signal,
}: {
	onEnded?: () => Promise<void>;
	onEnvelope?: (envelope: WebsiteGenerationEnvelopeV1) => void;
	signal?: AbortSignal;
} = {}) => ({
	onEnded,
	onEnvelope,
	promise: subscribeToWebsiteWorkflow({
		onEnded,
		onEnvelope,
		signal,
		websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
		workflowRunId: "run-generation",
	}),
});

beforeEach(() => {
	vi.useFakeTimers();
	streamWorkflow.mockReset();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("website workflow subscription", () => {
	it("streams every envelope and reconciles once when the stream ends", async () => {
		streamWorkflow.mockResolvedValue(
			(async function* () {
				yield planningEnvelope;
				yield writingEnvelope;
			})()
		);

		const subscription = subscribe();
		await subscription.promise;

		expect(subscription.onEnvelope).toHaveBeenCalledTimes(2);
		expect(subscription.onEnvelope).toHaveBeenNthCalledWith(1, planningEnvelope);
		expect(subscription.onEnvelope).toHaveBeenNthCalledWith(2, writingEnvelope);
		expect(subscription.onEnded).toHaveBeenCalledOnce();
	});

	it("resumes from the last cursor after a transient disconnect", async () => {
		streamWorkflow
			.mockResolvedValueOnce(
				(async function* () {
					yield planningEnvelope;
					throw new Error("connection reset");
				})()
			)
			.mockResolvedValueOnce(
				(async function* () {
					yield writingEnvelope;
				})()
			);

		const subscription = subscribe();
		await vi.waitFor(() => expect(streamWorkflow).toHaveBeenCalledOnce());
		await vi.advanceTimersByTimeAsync(400);
		await subscription.promise;

		expect(streamWorkflow).toHaveBeenNthCalledWith(
			2,
			{
				afterCursor: "0",
				websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
				workflowRunId: "run-generation",
			},
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);

		expect(subscription.onEnvelope).toHaveBeenCalledTimes(2);
		expect(subscription.onEnded).toHaveBeenCalledOnce();
	});

	it("stops retrying and does not reconcile after cancellation", async () => {
		const abortController = new AbortController();
		streamWorkflow.mockRejectedValue(new Error("offline"));
		const subscription = subscribe({ signal: abortController.signal });

		await vi.waitFor(() => expect(streamWorkflow).toHaveBeenCalledOnce());
		abortController.abort();
		await vi.advanceTimersByTimeAsync(400);
		await subscription.promise;

		expect(streamWorkflow).toHaveBeenCalledOnce();
		expect(subscription.onEnded).not.toHaveBeenCalled();
	});

	it("reconciles after the bounded retry schedule is exhausted", async () => {
		streamWorkflow.mockRejectedValue(new Error("offline"));
		const subscription = subscribe();

		await vi.waitFor(() => expect(streamWorkflow).toHaveBeenCalledOnce());

		for (const delay of [400, 800, 1600]) {
			await vi.advanceTimersByTimeAsync(delay);
		}

		await subscription.promise;

		expect(streamWorkflow).toHaveBeenCalledTimes(4);
		expect(subscription.onEnded).toHaveBeenCalledOnce();
	});
});
