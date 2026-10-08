import type { MastraDBMessage } from "@mastra/core/agent";

export type TestToolInvocation = Extract<
	MastraDBMessage["content"]["parts"][number],
	{ type: "tool-invocation" }
>["toolInvocation"];

export const createTestToolInvocationParts = (calls: Array<Partial<TestToolInvocation>>) =>
	calls.map((call, index) => ({
		toolInvocation: {
			args: {},
			result: {},
			state: "result" as const,
			toolCallId: `call-${index}`,
			toolName: "getLibraryAsset",
			...call,
		},
		type: "tool-invocation" as const,
	}));
