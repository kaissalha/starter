"use client";

import { BookOpen01Icon, Tick02Icon, Wrench01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ToolUIPart } from "ai";
import { useLocale, useTranslations } from "next-intl";
import { TextMorph } from "torph/react";
import { z } from "zod";

import { isPendingApprovalPart, useChatSession } from "@/components/chat/chat-session";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import type { OrganizationPermission } from "@starter/server/permissions";
import { Button } from "@starter/ui/components/button";

import { ChatStepItem, type ChatStepStatus } from "../chat-step-item";
import { AskUserQuestionsPart } from "./ask-user-questions-part";
import { WebSearchTool } from "./web-search-tool";

export type ToolState = ToolUIPart["state"];

type ToolApproval = NonNullable<ToolUIPart["approval"]>;

type ToolPartProps = {
	approval?: ToolApproval;
	errorText?: string;
	input?: unknown;
	isLast?: boolean;
	output?: unknown;
	state: ToolState;
	toolName: string;
};

const toolNames = [
	"addNumbers",
	"askUserQuestions",
	"createLibraryDocument",
	"editLibraryDocument",
	"generateLibraryImage",
	"getDocument",
	"getLibraryAsset",
	"inspectTable",
	"listDocuments",
	"listLibraryAssets",
	"retrieveKnowledge",
	"webSearch",
] as const;

const getToolLabelKey = (name: string) => toolNames.find((toolName) => toolName === name) ?? "other";

const approvalEditsSchema = z.looseObject({
	edits: z.array(z.looseObject({ operation: z.string() })).optional(),
});

export const getToolApprovalPermission = ({ input }: { input: unknown }): OrganizationPermission => {
	const parsed = approvalEditsSchema.safeParse(input);

	if (
		!parsed.success ||
		parsed.data.edits?.some(({ operation }) => operation.startsWith("delete") || operation.startsWith("remove"))
	) {
		return "delete";
	}

	return "write";
};

const ToolApprovalStep = ({
	approval,
	input,
	toolName,
}: {
	approval: ToolApproval;
	input?: unknown;
	toolName: string;
}) => {
	const t = useTranslations("components.chat.message.tool.approval");
	const { can } = useOrganizationPermissions();

	const {
		actions: { addToolApprovalResponse },
		messages,
	} = useChatSession();

	const last = messages.at(-1);
	const pendingApprovalParts = last?.role === "assistant" ? last.parts.filter(isPendingApprovalPart) : [];

	const pendingApprovals = pendingApprovalParts.map((part) => ({
		allowed:
			can("workspace.write") &&
			(can("workspace.delete") || getToolApprovalPermission({ input: part.input }) === "write"),
		id: part.approval.id,
	}));

	const toolLabels = useTranslations("components.chat.message.tool.actions");
	const action = toolLabels(getToolLabelKey(toolName));
	const hasDestructiveEdit = getToolApprovalPermission({ input }) === "delete";
	const canApprove = can("workspace.write") && (!hasDestructiveEdit || can("workspace.delete"));

	const respondToAll = (approved: boolean) => {
		if (!can("workspace.write") || (approved && pendingApprovals.some(({ allowed }) => !allowed))) {
			return;
		}

		pendingApprovals.forEach(({ id }) => addToolApprovalResponse({ approved, id }));
	};

	const showBulkBar = pendingApprovals.length > 1 && pendingApprovals.at(-1)?.id === approval.id;

	const showBulkApprove = can("workspace.write") && pendingApprovals.every(({ allowed }) => allowed);

	return (
		<div className='w-full rounded-2xl border border-border bg-muted/32 p-3'>
			<div className='flex items-start gap-3'>
				<span className='mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground smooth-shadow-ring-sm'>
					<HugeiconsIcon
						aria-hidden='true'
						className='size-3.5 scale-110'
						icon={Wrench01Icon}
						strokeWidth={1.75}
					/>
				</span>
				<div className='min-w-0 flex-1'>
					<p className='text-sm font-medium'>{t("title", { action })}</p>
					<p className='mt-0.5 text-xs leading-relaxed text-muted-foreground'>{t("summary.review")}</p>
				</div>
			</div>
			<div className='mt-3 flex flex-wrap items-center justify-end gap-2'>
				<Button
					disabled={!can("workspace.write")}
					onClick={() => addToolApprovalResponse({ approved: false, id: approval.id })}
					size='sm'
					type='button'
					variant='ghost'
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Cancel01Icon} strokeWidth={1.75} />
					{t("deny")}
				</Button>
				<Button
					disabled={!canApprove}
					onClick={() => addToolApprovalResponse({ approved: true, id: approval.id })}
					size='sm'
					type='button'
					variant={hasDestructiveEdit ? "destructive" : "default"}
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Tick02Icon} strokeWidth={1.75} />
					{t("approve")}
				</Button>
			</div>
			{showBulkBar && (
				<div className='mt-2 flex items-center justify-end gap-2 border-t border-border/64 pt-2'>
					<span className='me-auto text-xs text-muted-foreground'>
						{t("pendingCount", { count: pendingApprovals.length })}
					</span>
					<Button
						disabled={!can("workspace.write")}
						onClick={() => respondToAll(false)}
						size='sm'
						type='button'
						variant='ghost'
					>
						<HugeiconsIcon
							aria-hidden='true'
							className='scale-110'
							icon={Cancel01Icon}
							strokeWidth={1.75}
						/>
						{t("denyAll")}
					</Button>
					{showBulkApprove && (
						<Button
							disabled={!can("workspace.write")}
							onClick={() => respondToAll(true)}
							size='sm'
							type='button'
							variant='outline'
						>
							<HugeiconsIcon
								aria-hidden='true'
								className='scale-110'
								icon={Tick02Icon}
								strokeWidth={1.75}
							/>
							{t("approveAll", { count: pendingApprovals.length })}
						</Button>
					)}
				</div>
			)}
		</div>
	);
};

const getGenericToolLabel = ({
	isRunning,
	runningLabel,
	state,
	t,
	toolName,
}: {
	isRunning: boolean;
	runningLabel: string;
	state: ToolState;
	t: ReturnType<typeof useTranslations<"components.chat.message.tool">>;
	toolName: string;
}) => {
	if (state === "output-error" || state === "output-denied") {
		return state === "output-denied" ? t("cancelled") : t("error");
	}

	if (isRunning) {
		return runningLabel;
	}

	return t(`actions.${getToolLabelKey(toolName)}`);
};

const getGenericToolStatus = (state: ToolState): ChatStepStatus => {
	if (state === "output-error" || state === "output-denied") {
		return "error";
	}

	if (state === "output-available") {
		return "done";
	}

	return "running";
};

const GenericToolStep = ({ isLast, state, toolName }: { isLast: boolean; state: ToolState; toolName: string }) => {
	const locale = useLocale();
	const t = useTranslations("components.chat.message.tool");

	const isRunning =
		state === "input-streaming" ||
		state === "input-available" ||
		state === "approval-requested" ||
		state === "approval-responded";

	const isKnowledgeTool = toolName === "retrieveKnowledge";

	const runningLabel = isKnowledgeTool ? t("searchingKnowledge") : t("processing");

	const label = getGenericToolLabel({
		isRunning,
		runningLabel,
		state,
		t,
		toolName,
	});

	const icon = isKnowledgeTool ? (
		<HugeiconsIcon aria-hidden='true' className='size-3.5 scale-110' icon={BookOpen01Icon} strokeWidth={1.75} />
	) : (
		<HugeiconsIcon aria-hidden='true' className='size-3.5 scale-110' icon={Wrench01Icon} strokeWidth={1.75} />
	);

	const status = getGenericToolStatus(state);

	return (
		<ChatStepItem
			activity={isKnowledgeTool ? "searching" : "composing"}
			icon={icon}
			isLast={isLast}
			label={
				<TextMorph
					className={isRunning ? "font-medium" : undefined}
					disabled={locale === "ar"}
					duration={200}
					locale={locale}
				>
					{label}
				</TextMorph>
			}
			status={status}
		/>
	);
};

export const ToolPart = ({ approval, errorText, input, isLast = false, output, state, toolName }: ToolPartProps) => {
	if (state === "approval-requested" && approval && !approval.isAutomatic) {
		return <ToolApprovalStep approval={approval} input={input} toolName={toolName} />;
	}

	if (toolName === "webSearch") {
		return <WebSearchTool errorText={errorText} input={input} isLast={isLast} output={output} state={state} />;
	}

	if (toolName === "askUserQuestions") {
		return <AskUserQuestionsPart output={output} state={state} />;
	}

	return <GenericToolStep isLast={isLast} state={state} toolName={toolName} />;
};

ToolPart.displayName = "ToolPart";
