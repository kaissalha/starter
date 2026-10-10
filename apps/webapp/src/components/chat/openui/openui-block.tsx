"use client";

import { useCallback, useRef, useState } from "react";

import { type ActionEvent, type ParseResult, Renderer } from "@openuidev/react-lang";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { chatGenUILibrary } from "@/lib/genui-library";
import { getOpenUIValidationErrors } from "@starter/genui";
import { normalizeOpenUIActionText } from "@starter/genui/text";

import { isChatSessionBusy, useChatSession } from "../chat-session";

const urlSchema = z.compile(z.url().refine((value) => /^https?:\/\//u.test(value)));

const actionMessageSchema = z.compile(z.string());

const chatGenUIRoot = chatGenUILibrary.toSpec().root;

const isSafeParseResult = (result: ParseResult | null, source: string) =>
	chatGenUIRoot != null &&
	result != null &&
	getOpenUIValidationErrors({ expectedRoot: chatGenUIRoot, parsed: result, source }).length === 0;

const getActionURL = (event: ActionEvent) => {
	const url = urlSchema.safeParse(event.params.url);

	return url.success ? new URL(url.data) : undefined;
};

const getAssistantActionMessage = (event: ActionEvent) => {
	const message = actionMessageSchema.safeParse(event.humanFriendlyMessage);

	if (!message.success) {
		return undefined;
	}

	const normalizedMessage = normalizeOpenUIActionText(message.data);

	if (!normalizedMessage) {
		return undefined;
	}

	return normalizedMessage;
};

type OpenUIBlockProps = {
	code: string;
	complete: boolean;
	isStreaming: boolean;
};

export const OpenUIBlock = ({ code, complete, isStreaming }: OpenUIBlockProps) => {
	const session = useChatSession();
	const { sendMessage } = session.actions;
	const sessionBusy = isChatSessionBusy(session);

	const t = useTranslations("components.chat.message");
	const externalActionInFlight = useRef(false);
	const [hasError, setHasError] = useState(false);
	const [parseResult, setParseResult] = useState<ParseResult | null>(null);
	const parseIsValid = isSafeParseResult(parseResult, code);
	const rendererStreaming = isStreaming || sessionBusy || !complete || !parseIsValid;
	const controlsDisabled = rendererStreaming || hasError;
	const settledEmpty = complete && code.trim().length === 0;
	const showError = !isStreaming && (settledEmpty || !complete || hasError || (parseResult != null && !parseIsValid));

	const handleAction = useCallback(
		async (event: ActionEvent) => {
			if (controlsDisabled || externalActionInFlight.current) {
				return;
			}

			if (event.type === "open_url") {
				const url = getActionURL(event);

				if (!url || !window.confirm(t("openuiConfirmExternal", { host: url.hostname }))) {
					return;
				}

				externalActionInFlight.current = true;
				window.open(url.href, "_blank", "noopener,noreferrer");
				window.setTimeout(() => {
					externalActionInFlight.current = false;
				}, 0);

				return;
			}

			const message = getAssistantActionMessage(event);

			if (!message) {
				return;
			}

			externalActionInFlight.current = true;

			try {
				await sendMessage({ text: message });
			} catch {
				setHasError(true);
			} finally {
				window.setTimeout(() => {
					externalActionInFlight.current = false;
				}, 0);
			}
		},
		[controlsDisabled, sendMessage, t]
	);

	return (
		<div className='openui-chat-block my-3 text-foreground [&_.openui-card]:border-0 [&_.openui-card]:bg-transparent [&_.openui-card]:p-0 [&_.openui-card]:smooth-shadow-none [&_.openui-popover]:border-border [&_.openui-popover]:bg-popover [&_.openui-popover]:text-popover-foreground'>
			{showError ? (
				<p className='rounded-lg bg-muted/40 px-3 py-2 text-muted-foreground text-sm'>{t("openuiError")}</p>
			) : (
				<Renderer
					isStreaming={rendererStreaming}
					library={chatGenUILibrary}
					onAction={handleAction}
					onError={(errors) => setHasError(errors.length > 0)}
					onParseResult={setParseResult}
					response={code}
				/>
			)}
		</div>
	);
};

OpenUIBlock.displayName = "OpenUIBlock";
