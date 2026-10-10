"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";

import { Button } from "@starter/ui/components/button";
import { Textarea } from "@starter/ui/components/textarea";
import { cn } from "@starter/ui/lib/utils";

import type { AskUserQuestion } from "./ask-user-questions";

export const questionFontWeights = {
	medium: "'wght' 450, 'opsz' 15",
	semibold: "'wght' 550, 'opsz' 20",
} as const;

export const autosizeQuestionTextarea = (element: HTMLTextAreaElement) => {
	element.style.height = "0px";
	element.style.height = `${element.scrollHeight}px`;
	const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight) || 18;

	return element.scrollHeight > lineHeight * 1.5;
};

const EMPTY_OPTIONS: NonNullable<AskUserQuestion["options"]> = [];

const isTextInputTarget = (target: EventTarget | null): target is HTMLElement =>
	target instanceof HTMLElement &&
	(target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

type AskUserQuestionRowsProps = {
	onMultiToggle: (optionId: string) => void;
	onOtherChange: (text: string) => void;
	onOtherSubmit: () => void;
	onSingleSelect: (optionId: string) => void;
	otherLabel: string;
	otherText: string;
	question: AskUserQuestion;
	selectedIds: Array<string>;
	titleId: string;
};

export const AskUserQuestionRows = ({
	onMultiToggle,
	onOtherChange,
	onOtherSubmit,
	onSingleSelect,
	otherLabel,
	otherText,
	question,
	selectedIds,
	titleId,
}: AskUserQuestionRowsProps) => {
	const isMulti = !!question.multiSelect;
	const allowOther = !question.freeText && !!question.allowOther;
	const options = question.options ?? EMPTY_OPTIONS;
	const otherIndex = options.length;

	const [isOtherMultiline, setIsOtherMultiline] = useState(false);
	const otherInputRef = useRef<HTMLTextAreaElement | null>(null);
	const selectSingleOption = useEffectEvent(onSingleSelect);
	const toggleMultiOption = useEffectEvent(onMultiToggle);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}

			if (event.key < "1" || event.key > "9" || isTextInputTarget(event.target)) {
				return;
			}

			const optionIndex = Number.parseInt(event.key, 10) - 1;

			if (optionIndex < options.length) {
				event.preventDefault();
				const optionId = options[optionIndex].id;

				if (isMulti) {
					toggleMultiOption(optionId);
				} else {
					selectSingleOption(optionId);
				}
			} else if (optionIndex === options.length && allowOther) {
				event.preventDefault();
				otherInputRef.current?.focus();
			}
		};

		document.addEventListener("keydown", onKeyDown);

		return () => document.removeEventListener("keydown", onKeyDown);
	}, [options, isMulti, allowOther]);

	const otherTextareaRef = useCallback((element: HTMLTextAreaElement | null) => {
		otherInputRef.current = element;

		if (element && element.value) {
			setIsOtherMultiline(autosizeQuestionTextarea(element));
		}
	}, []);

	const selectedIdSet = new Set(selectedIds);

	return (
		<div
			aria-labelledby={titleId}
			className='relative -mx-3 flex flex-col gap-0.5'
			role={isMulti ? "group" : "radiogroup"}
		>
			{options.map((option, index) => {
				const isSelected = selectedIdSet.has(option.id);

				return (
					<QuestionRow
						aria-checked={isSelected}
						chipContent={index + 1}
						chipFilled={isSelected}
						isMulti={isMulti}
						isSelected={isSelected}
						key={option.id}
						onClick={() => (isMulti ? onMultiToggle(option.id) : onSingleSelect(option.id))}
						role={isMulti ? "checkbox" : "radio"}
					>
						<OptionLabel description={option.description} isSelected={isSelected} title={option.title} />
					</QuestionRow>
				);
			})}
			{allowOther && (
				<label
					className={cn(
						"relative z-10 flex min-h-10 cursor-text gap-3 rounded-[20px] py-1.5 pe-1.5 ps-3",
						isOtherMultiline ? "items-start" : "items-center",
						otherText.length > 0 ? "bg-foreground/10" : "hover:bg-foreground/6",
						"focus-within:ring-1 focus-within:ring-ring"
					)}
				>
					<span className='inline-grid min-w-0 flex-1'>
						<Textarea
							aria-label={otherLabel}
							className='col-start-1 row-start-1'
							onChange={(event) => {
								onOtherChange(event.target.value);
								setIsOtherMultiline(autosizeQuestionTextarea(event.target));
							}}
							onKeyDown={(event) => {
								if (event.key !== "Enter" || event.shiftKey || isMulti) {
									return;
								}

								event.preventDefault();
								onOtherSubmit();
							}}
							placeholder={`${otherLabel}…`}
							ref={otherTextareaRef}
							rows={1}
							style={{ fontVariationSettings: questionFontWeights.medium }}
							value={otherText}
							variant='inline'
						/>
					</span>
					<span
						className={cn(
							"relative inline-flex h-7 w-7 shrink-0 items-center justify-center",
							isOtherMultiline && "-mt-[5px]"
						)}
					>
						<span
							aria-hidden
							className={cn(
								"inline-flex h-5 w-5 items-center justify-center text-[11px]",
								isMulti && "rounded-[20px]",
								isMulti && otherText.length > 0
									? "bg-foreground text-background"
									: "text-muted-foreground",
								isMulti && otherText.length === 0 && "border border-border"
							)}
							style={{
								fontVariationSettings:
									otherText.length > 0 ? questionFontWeights.semibold : questionFontWeights.medium,
							}}
						>
							{otherIndex + 1}
						</span>
					</span>
				</label>
			)}
		</div>
	);
};

type OptionLabelProps = {
	description?: string;
	isSelected: boolean;
	title: string;
};

const OptionLabel = ({ description, isSelected, title }: OptionLabelProps) => (
	<span>
		<span className='inline-grid'>
			<span
				aria-hidden
				className='invisible col-start-1 row-start-1'
				style={{ fontVariationSettings: questionFontWeights.semibold }}
			>
				{title}
			</span>
			<span
				className='col-start-1 row-start-1 text-foreground'
				style={{
					fontVariationSettings: isSelected ? questionFontWeights.semibold : questionFontWeights.medium,
				}}
			>
				{title}
			</span>
		</span>
		{description && (
			<>
				{" "}
				<span className='text-muted-foreground'>{description}</span>
			</>
		)}
	</span>
);

type QuestionRowProps = {
	"aria-checked"?: boolean;
	ariaLabel?: string;
	children: ReactNode;
	chipContent: ReactNode;
	chipFilled: boolean;
	isMulti: boolean;
	isSelected: boolean;
	onClick: () => void;
	role: "radio" | "checkbox";
	topAlign?: boolean;
};

const getQuestionChipClassName = ({ chipFilled, isMulti }: { chipFilled: boolean; isMulti: boolean }) => {
	if (isMulti) {
		return chipFilled ? "bg-foreground text-background" : "border border-border text-muted-foreground";
	}

	return chipFilled ? "text-foreground" : "text-muted-foreground";
};

const QuestionRow = ({
	ariaLabel,
	children,
	chipContent,
	chipFilled,
	isMulti,
	isSelected,
	onClick,
	role,
	topAlign = false,
	...aria
}: QuestionRowProps) => (
	<Button
		aria-checked={aria["aria-checked"]}
		aria-label={ariaLabel}
		className={cn(
			"relative z-10 h-auto select-none whitespace-normal text-start sm:h-auto",
			topAlign ? "items-start" : "items-center"
		)}
		data-state={isSelected ? "checked" : "unchecked"}
		onClick={onClick}
		role={role}
		type='button'
		variant={isSelected ? "secondary" : "ghost"}
	>
		<span className='inline-flex min-w-0 flex-1 items-center'>{children}</span>
		<span
			className={cn("relative inline-flex h-7 w-7 shrink-0 items-center justify-center", topAlign && "-mt-[5px]")}
		>
			<span
				aria-hidden
				className={cn(
					"inline-flex h-5 w-5 items-center justify-center",
					isMulti && "rounded-[20px]",
					getQuestionChipClassName({ chipFilled, isMulti })
				)}
				style={{
					fontVariationSettings: chipFilled ? questionFontWeights.semibold : questionFontWeights.medium,
				}}
			>
				{chipContent}
			</span>
		</span>
	</Button>
);
