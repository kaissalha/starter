import { sleep } from "workflow";

import type { EventExecutionStep } from "../../services/events/executions";
import { claimEventExecutionStep, continueEventExecutionStep } from "./steps";

const runEventExecutionSteps = async ({
	executionId,
	step,
}: {
	executionId: string;
	step: EventExecutionStep;
}): Promise<void> => {
	if (step.status === "done") {
		return;
	}

	if (step.status === "wait") {
		await sleep(new Date(step.until));
	}

	await runEventExecutionSteps({ executionId, step: await continueEventExecutionStep(executionId) });
};

export const runEventExecutionWorkflow = async (executionId: string) => {
	"use workflow";
	await runEventExecutionSteps({ executionId, step: await claimEventExecutionStep(executionId) });
};
