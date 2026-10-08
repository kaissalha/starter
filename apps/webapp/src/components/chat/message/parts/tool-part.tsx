"use client";

import type { ReactNode } from "react";

import { BookOpen01Icon, Tick02Icon, Wrench01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { isToolUIPart } from "ai";
import { useLocale, useTranslations } from "next-intl";
import { TextMorph } from "torph/react";
import { z } from "zod";

import { type ChatSessionState, useChatSession } from "@/components/chat/stores/chat-session-store";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Button } from "@starter/ui/components/button";

import { ChatStepItem, type ChatStepStatus } from "../chat-step-item";
import { AskUserQuestionsPart } from "./ask-user-questions-part";
import { ContactApprovalDetails } from "./contact-approval-details";
import { getToolApprovalPermission } from "./tool-approval-permission";
import { getToolLabelKey } from "./tool-output-helpers";
import type { ToolApproval, ToolState } from "./tool-part-types";
import { WebSearchTool } from "./web-search-tool";
import { WebsiteDraftPreview } from "./website-draft-preview";

export type ToolPartProps = {
	approval?: ToolApproval;
	errorText?: string;
	input?: unknown;
	isLast?: boolean;
	output?: unknown;
	state: ToolState;
	toolCallId: string;
	toolName: string;
};

const websiteEditSchema = z.compile(
	z.looseObject({
		find: z.string().optional(),
		locale: z.string().optional(),
		operation: z.enum(["delete", "find-replace-text", "move-down", "move-up", "swap-layout", "update-text"]),
		replace: z.string().optional(),
		value: z.string().optional(),
	})
);

const approvalInputSchema = z.compile(
	z.looseObject({
		copy: z.record(z.string(), z.unknown()).optional(),
		edits: z.array(websiteEditSchema).optional(),
		images: z.record(z.string(), z.unknown()).optional(),
		index: z.number().int().nonnegative().optional(),
		links: z.record(z.string(), z.unknown()).optional(),
		logic: z.json().optional(),
		name: z.string().optional(),
		nodes: z.array(z.looseObject({ key: z.string().min(1) })).optional(),
		page: z.string().min(1).optional(),
		pattern: z.string().optional(),
		remove: z.array(z.string().min(1)).optional(),
		revision: z.string().min(1).optional(),
		section: z.string().min(1).optional(),
		source: z.string().optional(),
		structure: z.looseObject({ nodes: z.array(z.unknown()).optional() }).optional(),
		text: z.string().optional(),
		themeId: z.string().optional(),
	})
);

type WebsiteEditSummary = z.infer<typeof websiteEditSchema>;

type WebsiteMutationChange = {
	count?: number;
	kind:
		| "copy"
		| "logic-added"
		| "logic-removed"
		| "logic-updated"
		| "links"
		| "media"
		| "nodes"
		| "removed"
		| "script-added"
		| "script-updated";
};

const describeLogicChange = ({
	logic,
	toolName,
}: {
	logic: unknown;
	toolName: string;
}): WebsiteMutationChange["kind"] => {
	if (logic === null) {
		return "logic-removed";
	}

	const script = z.looseObject({ kind: z.literal("script") }).safeParse(logic).success;

	if (script) {
		return toolName === "composeWebsiteSection" ? "script-added" : "script-updated";
	}

	return toolName === "composeWebsiteSection" ? "logic-added" : "logic-updated";
};

const describeWebsiteMutation = ({
	input,
	toolName,
}: {
	input: z.infer<typeof approvalInputSchema>;
	toolName: string;
}) => {
	if (toolName !== "buildWebsite" && toolName !== "composeWebsiteSection") {
		return null;
	}

	const changes: Array<WebsiteMutationChange> = [];
	const nodeCount = input.nodes?.length ?? input.structure?.nodes?.length ?? 0;

	if (nodeCount > 0) {
		changes.push({ count: nodeCount, kind: "nodes" });
	}

	if (input.remove && input.remove.length > 0) {
		changes.push({ count: input.remove.length, kind: "removed" });
	}

	const copyCount = input.copy ? Object.keys(input.copy).length : 0;

	if (copyCount > 0) {
		changes.push({ count: copyCount, kind: "copy" });
	}

	const imageCount = input.images ? Object.keys(input.images).length : 0;

	if (imageCount > 0) {
		changes.push({ count: imageCount, kind: "media" });
	}

	const linkCount = input.links ? Object.keys(input.links).length : 0;

	if (linkCount > 0) {
		changes.push({ count: linkCount, kind: "links" });
	}

	if (Object.hasOwn(input, "logic")) {
		changes.push({ kind: describeLogicChange({ logic: input.logic, toolName }) });
	}

	return {
		changes,
		destructive: changes.some(({ kind }) => kind === "logic-removed" || kind === "removed"),
		position: input.index === undefined ? undefined : input.index + 1,
		target: toolName === "composeWebsiteSection" ? input.page : input.section,
	};
};

type WebsiteMutation = NonNullable<ReturnType<typeof describeWebsiteMutation>>;

const useApprovalSummary = ({
	edits,
	input,
	toolName,
	websiteMutation,
}: {
	edits: Array<WebsiteEditSummary>;
	input: z.infer<typeof approvalInputSchema> | undefined;
	toolName: string;
	websiteMutation: WebsiteMutation | null;
}) => {
	const t = useTranslations("components.chat.message.tool.approval");

	if (toolName === "deleteContact") {
		return t("summary.deleteContact");
	}

	if (toolName === "publishBrand") {
		return t("summary.publish");
	}

	if (toolName === "updateBrand") {
		return t("summary.updateBrand");
	}

	if (toolName === "changeLinkPageTheme" && input?.themeId) {
		return t("summary.changeLinkPageTheme", { theme: input.themeId });
	}

	if (toolName === "addWebsiteSection" && input) {
		return t("summary.addSection", {
			position: (input.index ?? 0) + 1,
		});
	}

	if (toolName === "composeWebsiteSection" && websiteMutation) {
		return t("summary.composeSection", {
			position: websiteMutation.position ?? 1,
		});
	}

	if (toolName === "buildWebsite" && websiteMutation) {
		return t("summary.modifySection");
	}

	return edits.length > 0 ? null : t("summary.review");
};

const approvalChangeCount = ({
	edits,
	websiteMutation,
}: {
	edits: Array<WebsiteEditSummary>;
	websiteMutation: WebsiteMutation | null;
}) => {
	if (edits.length > 1) {
		return edits.length;
	}

	if (websiteMutation && websiteMutation.changes.length > 1) {
		return websiteMutation.changes.reduce((total, change) => total + (change.count ?? 1), 0);
	}

	return null;
};

const websiteMutationToolNames = new Set([
	"previewWebsiteTemplate",
	"publishWebsite",
	"changeWebsiteTemplate",
	"generateWebsite",
	"generateWebsiteLayout",
	"cancelWebsiteWorkflow",
	"addWebsiteSection",
	"buildWebsite",
	"composeWebsiteSection",
	"editWebsite",
	"publishBrand",
	"updateBrand",
]);

const selectPendingApprovalParts = ({ messages }: ChatSessionState) => {
	const last = messages.at(-1);

	if (!last || last.role !== "assistant") {
		return [];
	}

	return last.parts.flatMap((part) =>
		isToolUIPart(part) && part.state === "approval-requested" && !part.approval.isAutomatic ? [part] : []
	);
};

const ApprovalChangeRow = ({ children, destructive = false }: { children: ReactNode; destructive?: boolean }) => (
	<li className='flex items-baseline gap-2 py-1.5'>
		<span
			aria-hidden='true'
			className={`mt-1 size-1.5 shrink-0 self-start rounded-full ${
				destructive ? "bg-destructive" : "bg-muted-foreground/48"
			}`}
		/>
		<div className='min-w-0 flex-1 text-xs leading-relaxed'>{children}</div>
	</li>
);

const WebsiteEditRow = ({ edit }: { edit: WebsiteEditSummary }) => {
	const t = useTranslations("components.chat.message.tool.approval");

	return (
		<ApprovalChangeRow destructive={edit.operation === "delete"}>
			<span className='font-medium'>{t(`summary.${edit.operation}`)}</span>
			{edit.operation === "update-text" && edit.value && (
				<span className='ms-1.5 text-muted-foreground' dir='auto'>
					&ldquo;{edit.value.length > 96 ? `${edit.value.slice(0, 96)}…` : edit.value}&rdquo;
				</span>
			)}
			{edit.operation === "find-replace-text" && edit.find !== undefined && (
				<span className='ms-1.5 text-muted-foreground' dir='auto'>
					&ldquo;{edit.find}&rdquo; → &ldquo;{edit.replace ?? ""}&rdquo;
				</span>
			)}
		</ApprovalChangeRow>
	);
};

const useWebsiteMutationSummary = (change: WebsiteMutationChange) => {
	const t = useTranslations("components.chat.message.tool.approval");

	switch (change.kind) {
		case "nodes":
			return t("summary.nodes", { count: change.count ?? 0 });
		case "removed":
			return t("summary.removed", { count: change.count ?? 0 });
		case "copy":
			return t("summary.copy", { count: change.count ?? 0 });
		case "media":
			return t("summary.media", { count: change.count ?? 0 });
		case "links":
			return t("summary.links", { count: change.count ?? 0 });
		case "logic-added":
			return t("summary.logicAdded");
		case "logic-updated":
			return t("summary.logicUpdated");
		case "logic-removed":
			return t("summary.logicRemoved");
		case "script-added":
			return t("summary.scriptAdded");
		case "script-updated":
			return t("summary.scriptUpdated");
	}
};

const WebsiteMutationRow = ({ change }: { change: WebsiteMutationChange }) => {
	const summary = useWebsiteMutationSummary(change);
	const destructive = change.kind === "logic-removed" || change.kind === "removed";

	return <ApprovalChangeRow destructive={destructive}>{summary}</ApprovalChangeRow>;
};

const WebsiteDraftApprovalPreview = ({
	input,
	toolName,
}: {
	input: z.infer<typeof approvalInputSchema> | undefined;
	toolName: string;
}) => {
	const revision = input?.revision;

	return revision && input && (toolName === "composeWebsiteSection" || toolName === "buildWebsite") ? (
		<WebsiteDraftPreview input={{ ...input, revision }} tool={toolName} />
	) : null;
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
	const addToolApprovalResponse = useChatSession((state) => state.actions?.addToolApprovalResponse);
	const pendingApprovalParts = useChatSession(selectPendingApprovalParts);

	const pendingApprovals = pendingApprovalParts.map((part) => ({
		allowed:
			can("workspace.write") &&
			(can("workspace.delete") ||
				getToolApprovalPermission({ input: part.input, toolName: part.type.slice("tool-".length) }) ===
					"write"),
		id: part.approval.id,
		websiteMutation: websiteMutationToolNames.has(part.type.slice("tool-".length)),
	}));

	const toolLabels = useTranslations("components.chat.message.tool.actions");
	const action = toolLabels(getToolLabelKey(toolName));
	const parsedInput = approvalInputSchema.safeParse(input);
	const approvalInput = parsedInput.success ? parsedInput.data : undefined;
	const edits = approvalInput?.edits ?? [];
	const websiteMutation = approvalInput ? describeWebsiteMutation({ input: approvalInput, toolName }) : null;

	const hasDestructiveEdit = getToolApprovalPermission({ input, toolName }) === "delete";
	const canApprove = can("workspace.write") && (!hasDestructiveEdit || can("workspace.delete"));
	const summary = useApprovalSummary({ edits, input: approvalInput, toolName, websiteMutation });
	const changeCount = approvalChangeCount({ edits, websiteMutation });

	const respondToAll = (approved: boolean) => {
		if (!can("workspace.write") || (approved && pendingApprovals.some(({ allowed }) => !allowed))) {
			return;
		}

		pendingApprovals.forEach(({ id }) => addToolApprovalResponse?.({ approved, id }));
	};

	const showBulkBar = pendingApprovals.length > 1 && pendingApprovals.at(-1)?.id === approval.id;

	const showBulkApprove =
		can("workspace.write") && pendingApprovals.every(({ allowed, websiteMutation }) => allowed && !websiteMutation);

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
					{summary ? (
						<p className='mt-0.5 text-xs leading-relaxed text-muted-foreground'>{summary}</p>
					) : (
						<p className='mt-0.5 text-xs leading-relaxed text-muted-foreground'>
							{t("editCount", { count: edits.length })}
						</p>
					)}
				</div>
			</div>
			{!summary && edits.length > 0 && (
				<ul className='mt-2 max-h-56 divide-y divide-border/64 overflow-y-auto rounded-xl bg-background/64 px-3 py-1'>
					{edits.map((edit, index) => (
						<WebsiteEditRow edit={edit} key={index} />
					))}
				</ul>
			)}
			{websiteMutation && websiteMutation.changes.length > 0 && (
				<ul className='mt-2 divide-y divide-border/64 rounded-xl bg-background/64 px-3 py-1'>
					{websiteMutation.changes.map((change) => (
						<WebsiteMutationRow change={change} key={change.kind} />
					))}
				</ul>
			)}
			<WebsiteDraftApprovalPreview input={approvalInput} toolName={toolName} />
			{["createContact", "updateContact", "deleteContact"].includes(toolName) && (
				<ContactApprovalDetails input={input} toolName={toolName} />
			)}
			<div className='mt-3 flex flex-wrap items-center justify-end gap-2'>
				<Button
					disabled={!can("workspace.write") || !addToolApprovalResponse}
					onClick={() => addToolApprovalResponse?.({ approved: false, id: approval.id })}
					size='sm'
					type='button'
					variant='ghost'
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Cancel01Icon} strokeWidth={1.75} />
					{t("deny")}
				</Button>
				<Button
					disabled={!canApprove || !addToolApprovalResponse}
					onClick={() => addToolApprovalResponse?.({ approved: true, id: approval.id })}
					size='sm'
					type='button'
					variant={hasDestructiveEdit ? "destructive" : "default"}
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Tick02Icon} strokeWidth={1.75} />
					{changeCount ? t("approveCount", { count: changeCount }) : t("approve")}
				</Button>
			</div>
			{showBulkBar && (
				<div className='mt-2 flex items-center justify-end gap-2 border-t border-border/64 pt-2'>
					<span className='me-auto text-xs text-muted-foreground'>
						{t("pendingCount", { count: pendingApprovals.length })}
					</span>
					<Button
						disabled={!can("workspace.write") || !addToolApprovalResponse}
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
							disabled={!can("workspace.write") || !addToolApprovalResponse}
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
		return <AskUserQuestionsPart errorText={errorText} output={output} state={state} />;
	}

	return <GenericToolStep isLast={isLast} state={state} toolName={toolName} />;
};

ToolPart.displayName = "ToolPart";
