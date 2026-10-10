import { RequestContext } from "@mastra/core/request-context";
import type { Tool as MastraTool } from "@mastra/core/tools";
import type { UIMessage } from "ai";
import { z } from "zod";

import type { dashboardChatTools } from "./tools";

export const appContextSchema = z.compile(
	z.looseObject({
		chatId: z.string().optional(),
		currentUser: z
			.strictObject({
				email: z.string().optional(),
				name: z.string().optional(),
			})
			.optional(),
		locale: z.string().optional(),
		organizationId: z.string().min(1),
		timezone: z.string().optional(),
		userId: z.string().min(1),
		useVisionModel: z.boolean().optional(),
	})
);

export type AppContext = z.infer<typeof appContextSchema>;

export const toolInput = <Schema extends z.ZodType>(schema: Schema) => z.compile(schema.meta({}));

export const createDashboardChatRequestContext = (values: AppContext) =>
	new RequestContext<AppContext>(Object.entries(values));

export type BaseCustomUIDataTypes = {
	attachment: {
		fileId: string;
		filename: string;
		mediaType: string;
	};
	error: {
		message: string;
	};
};

type InferMastraUITool<Tool> =
	Tool extends MastraTool<
		infer Input,
		infer Output,
		infer _Suspend,
		infer _Resume,
		infer _Context,
		infer _Id,
		infer _RequestContext
	>
		? { input: Input; output: Output }
		: never;

export type DashboardChatTools = {
	[Name in keyof typeof dashboardChatTools]: InferMastraUITool<(typeof dashboardChatTools)[Name]>;
};

export type DashboardChatUIMessage = UIMessage<{ createdAt?: string }, BaseCustomUIDataTypes, DashboardChatTools>;
