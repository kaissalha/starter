"use client";

import { useCallback, useId, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

import { ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { Button } from "@starter/ui/components/button";
import { Kbd } from "@starter/ui/components/kbd";
import { Textarea } from "@starter/ui/components/textarea";
import { cn } from "@starter/ui/lib/utils";

import { AskUserQuestionRows } from "./ask-user-question-rows";
import { autosizeQuestionTextarea, questionFontWeights } from "./ask-user-question-utils";

export type AskUserQuestion = {
	allowOther?: boolean;
	freeText?: boolean;
	freeTextPlaceholder?: string;
	id: string;
	multiSelect?: boolean;
	options?: Array<{ description?: string; id: string; title: string }>;
	otherPlaceholder?: string;
	skippable?: boolean;
	title: string;
};

export type AskUserAnswer = {
	otherText?: string;
	questionId: string;
	selectedIds: Array<string>;
	skipped?: boolean;
};

type Answers = Record<string, AskUserAnswer>;

export type AskUserQuestionsProps = {
	className?: string;
	onComplete: (answers: Answers) => void;
	questions: Array<AskUserQuestion>;
};

export type PendingAskUserQuestions = {
	questions: Array<AskUserQuestion>;
	toolCallId: string;
};

const EMPTY_SELECTED_IDS: Array<string> = [];

const detectMac = () => {
	const nav: (Navigator & { userAgentData?: { platform?: string } }) | undefined = globalThis.navigator;

	if (!nav) {
		return false;
	}

	return /mac/i.test(nav.userAgentData?.platform || nav.platform || "");
};

export const AskUserQuestions = ({ className, onComplete, questions }: AskUserQuestionsProps) => {
	const t = useTranslations("components.chat.chatInput.clarify");
	const reactId = useId();
	const [index, setIndex] = useState(0);
	const [answers, setAnswers] = useState<Answers>({});
	const [isMac] = useState(detectMac);

	const total = questions.length;
	const safeIndex = Math.min(index, Math.max(0, total - 1));
	const hasQuestion = questions[safeIndex] !== undefined;
	const question = questions[safeIndex] ?? { id: "", title: "" };
	const qId = question.id;
	const titleId = `${reactId}-${qId}-title`;
	const currentAnswer = answers[qId] ?? { questionId: qId, selectedIds: EMPTY_SELECTED_IDS };
	const isMulti = !!question.multiSelect;
	const isSkippable = question.skippable !== false;
	const isFreeText = !!question.freeText;
	const selectedIds = currentAnswer.selectedIds;
	const otherText = currentAnswer.otherText ?? "";

	const writeAnswer = useCallback(
		(partial: Omit<AskUserAnswer, "questionId">) => {
			setAnswers((prev) => ({
				...prev,
				[qId]: { questionId: qId, ...partial },
			}));
		},
		[qId]
	);

	const finishOrAdvance = useCallback(
		(snapshot: Answers) => {
			if (safeIndex >= total - 1) {
				onComplete(snapshot);

				return;
			}

			setIndex(safeIndex + 1);
		},
		[onComplete, safeIndex, total]
	);

	const patchAndAdvance = useCallback(
		(partial: Omit<AskUserAnswer, "questionId">) => {
			const next = {
				...answers,
				[qId]: { ...answers[qId], questionId: qId, skipped: false, ...partial },
			};

			setAnswers(next);
			finishOrAdvance(next);
		},
		[answers, finishOrAdvance, qId]
	);

	const handleSingleSelect = useCallback(
		(optionId: string) => {
			patchAndAdvance({ otherText: currentAnswer.otherText, selectedIds: [optionId] });
		},
		[currentAnswer.otherText, patchAndAdvance]
	);

	const handleMultiToggle = useCallback(
		(optionId: string) => {
			const ids = new Set(currentAnswer.selectedIds);

			if (ids.has(optionId)) {
				ids.delete(optionId);
			} else {
				ids.add(optionId);
			}

			writeAnswer({ otherText: currentAnswer.otherText, selectedIds: [...ids], skipped: false });
		},
		[currentAnswer.otherText, currentAnswer.selectedIds, writeAnswer]
	);

	const handleOtherChange = useCallback(
		(text: string) => {
			writeAnswer({ otherText: text, selectedIds: currentAnswer.selectedIds, skipped: false });
		},
		[currentAnswer.selectedIds, writeAnswer]
	);

	const handleOtherSubmit = useCallback(() => {
		const text = otherText.trim();

		if (!text) {
			return;
		}

		patchAndAdvance({ otherText: text, selectedIds: currentAnswer.selectedIds });
	}, [currentAnswer.selectedIds, otherText, patchAndAdvance]);

	const handleSkip = useCallback(() => {
		const next = {
			...answers,
			[qId]: {
				otherText: currentAnswer.otherText,
				questionId: qId,
				selectedIds: currentAnswer.selectedIds,
				skipped: true,
			},
		};

		setAnswers(next);
		finishOrAdvance(next);
	}, [answers, currentAnswer.otherText, currentAnswer.selectedIds, finishOrAdvance, qId]);

	const handleSubmit = useCallback(() => {
		if (isFreeText) {
			handleOtherSubmit();

			return;
		}

		finishOrAdvance(answers);
	}, [answers, finishOrAdvance, handleOtherSubmit, isFreeText]);

	const handleBack = useCallback(() => {
		if (safeIndex > 0) {
			setIndex(safeIndex - 1);
		}
	}, [safeIndex]);

	const handleRootKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		const mod = isMac ? event.metaKey : event.ctrlKey;

		if (event.key !== "Enter" || !mod || !(isMulti || isFreeText)) {
			return;
		}

		event.preventDefault();

		if (isFreeText || selectedIds.length > 0 || otherText.trim().length > 0) {
			handleSubmit();
		}
	};

	if (!hasQuestion) {
		return (
			<div className={cn("w-full max-w-[520px] rounded-3xl border border-border bg-card p-5", className)}>
				<p className='text-[13px] text-muted-foreground'>{t("noQuestions")}</p>
			</div>
		);
	}

	const showBack = total > 1 && safeIndex > 0;
	const showSkip = total > 1 && isSkippable;
	const showSubmit = isMulti || isFreeText;
	const showFooter = showBack || showSkip || showSubmit;

	const submitDisabled = isFreeText
		? otherText.trim().length === 0
		: selectedIds.length === 0 && otherText.trim().length === 0;

	const submitLabel = safeIndex >= total - 1 ? t("finish") : t("continue");

	return (
		<div
			className={cn(
				"relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-border bg-card",
				className
			)}
			onKeyDown={handleRootKey}
		>
			<div className='flex items-center px-4 pt-4 pb-2 text-[12px] text-muted-foreground sm:px-5 sm:pt-5'>
				<span>{t("progress", { current: safeIndex + 1, total })}</span>
			</div>

			<div className={cn("px-4 sm:px-5", showFooter ? "pb-1" : "pb-2.5 sm:pb-3")}>
				<div className='flex flex-col gap-2' key={qId}>
					<h3
						className='text-[16px] leading-snug text-foreground'
						id={titleId}
						style={{ fontVariationSettings: questionFontWeights.semibold }}
					>
						{question.title}
					</h3>

					{isFreeText ? (
						<FreeTextInput
							key={qId}
							onChange={handleOtherChange}
							placeholder={question.freeTextPlaceholder ?? t("freeTextPlaceholder")}
							titleId={titleId}
							value={otherText}
						/>
					) : (
						<AskUserQuestionRows
							key={qId}
							onMultiToggle={handleMultiToggle}
							onOtherChange={handleOtherChange}
							onOtherSubmit={handleOtherSubmit}
							onSingleSelect={handleSingleSelect}
							otherLabel={question.otherPlaceholder ?? t("otherPlaceholder")}
							otherText={otherText}
							question={question}
							selectedIds={selectedIds}
							titleId={titleId}
						/>
					)}
				</div>
			</div>

			{showFooter && (
				<QuestionFooter
					backAction={showBack ? { label: t("back"), onClick: handleBack } : undefined}
					skipAction={showSkip ? { label: t("skip"), onClick: handleSkip } : undefined}
					submitAction={
						showSubmit
							? {
									disabled: submitDisabled,
									label: submitLabel,
									onClick: handleSubmit,
									shortcut: isMac ? "⌘" : "⌃",
								}
							: undefined
					}
				/>
			)}
		</div>
	);
};

type FreeTextInputProps = {
	onChange: (text: string) => void;
	placeholder: string;
	titleId: string;
	value: string;
};

const FreeTextInput = ({ onChange, placeholder, titleId, value }: FreeTextInputProps) => {
	const textareaRef = useCallback((element: HTMLTextAreaElement | null) => {
		if (element) {
			autosizeQuestionTextarea(element);
			element.focus({ preventScroll: true });
		}
	}, []);

	return (
		<label
			className={cn(
				"relative -mx-3 mt-1 min-h-[76px] cursor-text rounded-[20px] px-3 py-2.5 transition-colors",
				value.length > 0
					? "bg-foreground/10"
					: "hover:bg-foreground/6 focus-within:bg-card focus-within:ring-1 focus-within:ring-inset focus-within:ring-border"
			)}
		>
			<Textarea
				aria-labelledby={titleId}

				onChange={(event) => {
					onChange(event.target.value);
					autosizeQuestionTextarea(event.target);
				}}
				placeholder={placeholder}
				ref={textareaRef}
				rows={1}
				style={{ fontVariationSettings: questionFontWeights.medium }}
				value={value}
				variant='inline'
			/>
		</label>
	);
};

type FooterButtonProps = {
	children: ReactNode;
	disabled?: boolean;
	onClick: () => void;
	variant: "primary" | "ghost";
};

const FooterButton = ({ children, disabled, onClick, variant }: FooterButtonProps) => (
	<Button
		disabled={disabled}
		onClick={onClick}
		size='sm'
		type='button'
		variant={variant === "primary" ? "default" : "ghost"}
	>
		{children}
	</Button>
);

type FooterAction = {
	label: string;
	onClick: () => void;
};

type FooterSubmitAction = FooterAction & {
	disabled: boolean;
	shortcut: string;
};

const QuestionFooter = ({
	backAction,
	skipAction,
	submitAction,
}: {
	backAction?: FooterAction;
	skipAction?: FooterAction;
	submitAction?: FooterSubmitAction;
}) => (
	<div className='px-4 pt-1 pb-2 sm:px-5'>
		<div className='-mx-2 flex items-center justify-between gap-2 sm:-mx-3'>
			<div className='flex min-w-0 flex-1 items-center gap-2'>
				{backAction && (
					<FooterButton onClick={backAction.onClick} variant='ghost'>
						<HugeiconsIcon
							aria-hidden='true'
							className='hidden sm:block scale-110'
							icon={ArrowLeft02Icon}

							strokeWidth={1.75}
						/>
						{backAction.label}
					</FooterButton>
				)}
			</div>
			<div className='flex items-center gap-2'>
				{skipAction && (
					<FooterButton onClick={skipAction.onClick} variant='ghost'>
						{skipAction.label}
						<HugeiconsIcon
							aria-hidden='true'
							className='hidden sm:block scale-110'
							icon={ArrowRight02Icon}

							strokeWidth={1.75}
						/>
					</FooterButton>
				)}
				{submitAction && (
					<FooterButton disabled={submitAction.disabled} onClick={submitAction.onClick} variant='primary'>
						<span className='inline-flex items-center gap-1.5'>
							{submitAction.label}
							<Kbd aria-hidden className='hidden sm:inline-flex' suppressHydrationWarning>
								{submitAction.shortcut}
								{"↵"}
							</Kbd>
						</span>
					</FooterButton>
				)}
			</div>
		</div>
	</div>
);
