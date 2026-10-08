import { RequestContext } from "@mastra/core/request-context";
import type { Tool as MastraTool } from "@mastra/core/tools";
import { isToolUIPart, type UIMessage } from "ai";
import { z } from "zod";

import type { dashboardChatTools } from "./tools";

export const appContextSchema = z.compile(
	z.looseObject({
		approvalContinuation: z.boolean().optional(),
		chatId: z.string().optional(),
		currentUser: z
			.strictObject({
				email: z.string().optional(),
				name: z.string().optional(),
			})
			.optional(),
		locale: z.string().optional(),
		modelTier: z.enum(["full", "simple"]).optional(),
		organizationId: z.string().min(1),
		routedSkill: z.enum(["library", "notifications", "visualization"]).nullable().optional(),
		timezone: z.string().optional(),
		userId: z.string().min(1),
		useVisionModel: z.boolean().optional(),
	})
);

export type AppContext = z.infer<typeof appContextSchema>;

export const toolInput = <Schema extends z.ZodType>(schema: Schema) => z.compile(schema.meta({}));

export const createDashboardChatRequestContext = (values: AppContext) =>
	new RequestContext<AppContext>([
		["approvalContinuation", values.approvalContinuation],
		["chatId", values.chatId],
		["currentUser", values.currentUser],
		["locale", values.locale],
		["modelTier", values.modelTier],
		["organizationId", values.organizationId],
		["routedSkill", values.routedSkill],
		["timezone", values.timezone],
		["userId", values.userId],
		["useVisionModel", values.useVisionModel],
	]);

export type BaseCustomUIDataTypes = {
	"append-message": string;
	attachment: {
		fileId: string;
		filename: string;
		mediaType: string;
	};
	"chat-created": {
		chatId: string;
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

// oxlint-disable-next-line typescript/no-explicit-any
export type BaseChatUIMessage = UIMessage<any, any, any>;

const toolPartStateSchema = z.compile(z.looseObject({ state: z.string() }));

const normalizeTransientPartFields = <Part extends BaseChatUIMessage["parts"][number]>(part: Part): Part => {
	const normalized = structuredClone(part);

	if (normalized.type === "text") {
		delete normalized.state;
		normalized.text = normalized.text.trim();
	}

	if ("providerMetadata" in normalized) {
		delete normalized.providerMetadata;
	}

	if (isToolUIPart(normalized)) {
		delete normalized.callProviderMetadata;

		if (normalized.toolMetadata) {
			delete normalized.toolMetadata.__mastraObservability;

			if (Object.keys(normalized.toolMetadata).length === 0) {
				delete normalized.toolMetadata;
			}
		}

		if ("resultProviderMetadata" in normalized) {
			delete normalized.resultProviderMetadata;
		}
	}

	if (
		isToolUIPart(normalized) &&
		normalized.state === "approval-responded" &&
		normalized.approval.reason === undefined
	) {
		delete normalized.approval.reason;
	}

	return normalized;
};

export const withoutTransientToolParts = <Message extends BaseChatUIMessage>(
	messages: Array<Message>,
	{ keepErrors = false }: { keepErrors?: boolean } = {}
): Array<Message> =>
	messages.flatMap<Message>((message) => {
		const parts = message.parts
			.filter(
				(part) =>
					part.type !== "reasoning" &&
					part.type !== "tool-skill" &&
					part.type !== "tool-skill_read" &&
					part.type !== "step-start" &&
					!(
						!keepErrors &&
						part.type.startsWith("tool-") &&
						toolPartStateSchema.safeParse(part).data?.state === "output-error"
					)
			)
			.map(normalizeTransientPartFields);

		return parts.length > 0 ? [{ ...message, parts }] : [];
	});

export type DashboardChatUIMessage = UIMessage<{ createdAt?: string }, BaseCustomUIDataTypes, DashboardChatTools>;
