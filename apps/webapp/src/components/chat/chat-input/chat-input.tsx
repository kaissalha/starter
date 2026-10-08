"use client";

import { createContext, use, useCallback, useEffect, useMemo, useRef } from "react";

import { ArrowUp02Icon, SquareIcon } from "@hugeicons/core-free-icons";
import { MorphIcon } from "morphicons/react";
import { useTranslations } from "next-intl";

import { Button } from "@starter/ui/components/button";
import { Textarea } from "@starter/ui/components/textarea";
import { cn } from "@starter/ui/lib/utils";

type ChatInputContextValue = {
	canSubmit: boolean;
	isDisabled: boolean;
	isLoading: boolean;
	onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
	onMessageSubmit: () => void;
	onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
	onShellPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
	onStop?: () => void;
	syncTextareaHeight: () => void;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	value: string;
};

const ChatInputContext = createContext<ChatInputContextValue | null>(null);

export const useChatInputContext = () => {
	const context = use(ChatInputContext);

	if (!context) {
		throw new Error("ChatInput components must be used within ChatInput");
	}

	return context;
};

type ChatInputProps = {
	canSubmit?: boolean;
	children: React.ReactNode;
	className?: string;
	containerClassName?: string;
	disabled?: boolean;
	loading?: boolean;
	onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
	onMessageSubmit: () => void;
	onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
	onStop?: () => void;
	textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
	value: string;
};

export const ChatInput = ({
	canSubmit,
	children,
	className,
	containerClassName,
	disabled = false,
	loading = false,
	onChange,
	onMessageSubmit,
	onPaste,
	onStop,
	textareaRef: externalTextareaRef,
	value,
}: ChatInputProps) => {
	const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
	const textareaRef = externalTextareaRef ?? internalTextareaRef;

	const syncTextareaHeight = useCallback(() => {
		const el = textareaRef.current;

		if (!el) {
			return;
		}

		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 384)}px`;
	}, [textareaRef]);

	const onShellPointerDown = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (event.button !== 0) {
				return;
			}

			const target = event.target;

			if (!(target instanceof Element)) {
				return;
			}

			const interactiveTarget = target.closest(
				"button, a, input, select, textarea, [contenteditable]:not([contenteditable='false']), [role='button']"
			);

			if (interactiveTarget) {
				return;
			}

			event.preventDefault();
			textareaRef.current?.focus({ preventScroll: true });
		},
		[textareaRef]
	);

	const resolvedCanSubmit = canSubmit ?? Boolean(value.trim());

	const contextValue = useMemo(
		() => ({
			canSubmit: resolvedCanSubmit,
			isDisabled: disabled || loading,
			isLoading: loading,
			onChange,
			onMessageSubmit,
			onPaste,
			onShellPointerDown,
			onStop,
			syncTextareaHeight,
			textareaRef,
			value,
		}),
		[
			value,
			onChange,
			onMessageSubmit,
			loading,
			disabled,
			resolvedCanSubmit,
			onStop,
			onPaste,
			textareaRef,
			syncTextareaHeight,
			onShellPointerDown,
		]
	);

	return (
		<ChatInputContext.Provider value={contextValue}>
			<div className={cn("relative z-10 mx-auto w-full max-w-3xl", containerClassName, className)}>
				<div
					className='relative z-10 flex w-full cursor-text flex-col overflow-hidden rounded-lg bg-background text-base/5 smooth-shadow-ring-sm smooth-ring-input transition-[color,background-color,box-shadow] sm:text-sm'
					data-slot='chat-input'
					onPointerDown={onShellPointerDown}
				>
					<div className='flex flex-col'>{children}</div>
				</div>
			</div>
		</ChatInputContext.Provider>
	);
};

ChatInput.displayName = "ChatInput";

type ChatInputAttachmentsProps = {
	children: React.ReactNode;
	className?: string;
};

export const ChatInputAttachments = ({ children, className }: ChatInputAttachmentsProps) => {
	return (
		<div className={cn("overflow-hidden", className)}>
			<div className='px-4 pt-4 pb-2'>
				<div className='flex flex-col gap-2'>
					<div
						className='-mt-2 -ms-2 flex max-w-full flex-row gap-3 overflow-x-auto pt-2 pb-px ps-2 scrollbar-none [&::-webkit-scrollbar]:hidden'
						data-composer-attachment
					>
						{children}
					</div>
				</div>
			</div>
		</div>
	);
};

ChatInputAttachments.displayName = "ChatInputAttachments";

type ChatInputBodyProps = {
	children: React.ReactNode;
	className?: string;
};

export const ChatInputBody = ({ children, className }: ChatInputBodyProps) => {
	return (
		<div className={cn("flex flex-col gap-1.5 p-2", className)} data-slot='chat-input-body'>
			{children}
		</div>
	);
};

ChatInputBody.displayName = "ChatInputBody";

type ChatInputTextAreaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">;

export const ChatInputTextArea = ({ autoFocus, className, placeholder, ...props }: ChatInputTextAreaProps) => {
	const t = useTranslations("components.chat.chatInput");

	const { canSubmit, isDisabled, onChange, onMessageSubmit, onPaste, syncTextareaHeight, textareaRef, value } =
		useChatInputContext();

	useEffect(() => {
		if (autoFocus && window.matchMedia("(pointer: fine)").matches) {
			textareaRef.current?.focus();
		}
	}, [autoFocus, textareaRef]);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (
				event.key !== "Enter" ||
				event.shiftKey ||
				!canSubmit ||
				window.matchMedia("(pointer: coarse)").matches
			) {
				return;
			}

			event.preventDefault();
			onMessageSubmit();
		},
		[canSubmit, onMessageSubmit]
	);

	return (
		<div className='relative' data-slot='chat-input-textarea'>
			<Textarea
				aria-label={t("writePrompt")}
				className={cn(
					"wrap-break-word max-h-100 min-h-16.5 w-full resize-none overflow-x-hidden overflow-y-auto",
					className
				)}
				disabled={isDisabled}
				onChange={(event) => {
					onChange(event);
					syncTextareaHeight();
				}}
				onInput={syncTextareaHeight}
				onKeyDown={handleKeyDown}
				onPaste={onPaste}
				placeholder={placeholder ?? t("placeholder")}
				ref={textareaRef}
				rows={1}
				spellCheck={false}
				value={value}
				variant='composer'
				{...props}
			/>
		</div>
	);
};

ChatInputTextArea.displayName = "ChatInputTextArea";

type ChatInputControlsProps = {
	children: React.ReactNode;
	className?: string;
};

export const ChatInputControls = ({ children, className }: ChatInputControlsProps) => {
	return <div className={cn("relative flex w-full items-center justify-between gap-2", className)}>{children}</div>;
};

ChatInputControls.displayName = "ChatInputControls";

type ChatInputSubmitProps = Omit<React.ComponentProps<typeof Button>, "onClick">;

export const ChatInputSubmit = ({ className, ...props }: ChatInputSubmitProps) => {
	const t = useTranslations("components.chat.input");
	const { canSubmit, isDisabled, isLoading, onMessageSubmit, onStop } = useChatInputContext();
	const isStopping = isLoading && Boolean(onStop);

	return (
		<Button
			aria-label={isStopping ? t("stop") : t("send")}
			className={cn("shrink-0", className)}
			disabled={!isStopping && (isDisabled || !canSubmit)}
			onClick={(event) => {
				if (isStopping) {
					onStop?.();

					return;
				}

				event.preventDefault();

				if (canSubmit) {
					onMessageSubmit();
				}
			}}
			size='icon'
			type='button'
			variant={isStopping ? "secondary" : undefined}
			{...props}
		>
			<MorphIcon
				className={cn("scale-110", isStopping && "fill-current")}
				icon={isStopping ? SquareIcon : ArrowUp02Icon}
				reducedMotion='user'
				strokeWidth={1.75}
			/>
		</Button>
	);
};

ChatInputSubmit.displayName = "ChatInputSubmit";
