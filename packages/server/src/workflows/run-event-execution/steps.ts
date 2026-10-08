import { getWorkflowMetadata } from "workflow";

export const claimEventExecutionStep = async (executionId: string) => {
	"use step";
	const { claimEventExecution } = await import("../../services/events/executions");

	return claimEventExecution({ executionId, runId: getWorkflowMetadata().workflowRunId });
};

export const continueEventExecutionStep = async (executionId: string) => {
	"use step";
	const { continueEventExecution } = await import("../../services/events/executions");

	return continueEventExecution({ executionId, runId: getWorkflowMetadata().workflowRunId });
};

continueEventExecutionStep.maxRetries = 0;
