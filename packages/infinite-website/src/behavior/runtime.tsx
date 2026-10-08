"use client";

import { createContext, useContext, useEffect, useEffectEvent, useId, useState, type ReactNode } from "react";

import { cn } from "cn";

import type { Layout } from "../document/structure-schema";
import { layoutStyle } from "../primitives/layout";
import {
	decimalValuePattern,
	decimalValueSchema,
	type SiteBehaviorProgramV1,
	type SiteBehaviorValueFormatV1,
} from "./contracts";
import { createSiteScriptSession, siteScriptProgramInputs, type SiteScriptSession } from "./custom-script";
import { evaluateSiteBehaviorOutputs, scalePercentagePoints, type SiteBehaviorOutputValue } from "./expression-runtime";

type MutableReference<Value> = { value: Value };

export { evaluateSiteBehavior } from "./expression-runtime";

declare global {
	namespace Intl {
		// oxlint-disable-next-line typescript/consistent-type-definitions
		interface NumberFormat {
			format(value: string): string;
		}
	}
}

const useBehaviorRuntime = ({ program }: { program: SiteBehaviorProgramV1 }) => {
	const [slots, setSlots] = useState(() => Object.fromEntries(program.slots.map((slot) => [slot.key, slot.initial])));

	const [scriptOutputs, setScriptOutputs] = useState(
		program.expressionProfile === "custom-js-v1" ? program.initialOutputs : null
	);

	const [scriptSession, setScriptSession] = useState<SiteScriptSession | null>(null);

	const evaluateLatest = useEffectEvent((session: SiteScriptSession) => {
		if (program.expressionProfile !== "custom-js-v1") {
			return;
		}

		const outputs = session.evaluate({ inputs: siteScriptProgramInputs({ program, slots }) });
		setScriptOutputs(outputs);
	});

	useEffect(() => {
		if (program.expressionProfile !== "custom-js-v1") {
			return;
		}

		const controller = new AbortController();
		const sessionReference: MutableReference<SiteScriptSession | null> = { value: null };

		const initialize = async () => {
			const created = await createSiteScriptSession({
				outputs: program.outputs,
				script: program.script,
				signal: controller.signal,
				targets: program.targets,
			});

			if (!created || controller.signal.aborted) {
				created?.dispose();

				if (!controller.signal.aborted) {
					setScriptOutputs(null);
				}

				return;
			}

			sessionReference.value = created;
			setScriptSession(created);
			evaluateLatest(created);
		};

		initialize();

		return () => {
			controller.abort();
			sessionReference.value?.dispose();
		};
	}, [program]);

	if (program.expressionProfile !== "custom-js-v1") {
		return {
			outputs: evaluateSiteBehaviorOutputs({ program, slots }),
			ready: true,
			runEvent:
				program.expressionProfile === "site-expression-v2"
					? (event: string) => {
							const anchor = program.events?.[event];

							if (anchor) {
								scrollToWebsiteAnchor(anchor);
							}
						}
					: undefined,
			slots,
			updateSlot: (key: string, value: string) => setSlots((current) => ({ ...current, [key]: value })),
		};
	}

	return {
		outputs: scriptOutputs,
		ready: scriptSession !== null && scriptOutputs !== null,
		runEvent: (event: string) => {
			if (!program.events?.includes(event)) {
				return;
			}

			const command = scriptSession?.interact({ event });

			if (command?.type !== "scroll-to") {
				return;
			}

			scrollToWebsiteAnchor(command.anchor);
		},
		slots,
		updateSlot: (key: string, value: string) => {
			const next = { ...slots, [key]: value };
			setSlots(next);

			if (scriptSession) {
				setScriptOutputs(scriptSession.evaluate({ inputs: siteScriptProgramInputs({ program, slots: next }) }));
			}
		},
	};
};

const scrollToWebsiteAnchor = (anchor: string) => {
	document.querySelector(`[data-website-anchor="${anchor}"]`)?.scrollIntoView({
		behavior: "smooth",
		block: "start",
	});
};

const localizedDecimalCharacters = new Map([
	["٠", "0"],
	["١", "1"],
	["٢", "2"],
	["٣", "3"],
	["٤", "4"],
	["٥", "5"],
	["٦", "6"],
	["٧", "7"],
	["٨", "8"],
	["٩", "9"],
	["۰", "0"],
	["۱", "1"],
	["۲", "2"],
	["۳", "3"],
	["۴", "4"],
	["۵", "5"],
	["۶", "6"],
	["۷", "7"],
	["۸", "8"],
	["۹", "9"],
	["٫", "."],
	["−", "-"],
]);

export const normalizeBehaviorDecimalInput = (value: string) =>
	Array.from(value, (character) => localizedDecimalCharacters.get(character) ?? character).join("");

const formatExactDecimal = ({
	format,
	locale,
	value,
}: {
	format: SiteBehaviorValueFormatV1;
	locale: string;
	value: string;
}) => {
	const formattedValue =
		format.style === "percent" && format.valueScale === "percentage-points" ? scalePercentagePoints(value) : value;

	const formatter = new Intl.NumberFormat(locale, {
		currency: format.style === "currency" ? format.currency : undefined,
		maximumFractionDigits: format.maximumFractionDigits,
		style: format.style,
	});

	return formatter.format(formattedValue);
};

const BehaviorContext = createContext<{
	outputs: Record<string, SiteBehaviorOutputValue> | null;
	ready: boolean;
	runEvent?: (event: string) => void;
	slots: Record<string, string>;
	updateSlot: (key: string, value: string) => void;
} | null>(null);

export const BehaviorVisibility = ({ children, output }: { children: ReactNode; output?: string }) => {
	const runtime = useContext(BehaviorContext);

	return output && runtime?.outputs?.[output] !== true ? null : children;
};

export const BehaviorRuntimeBoundary = ({
	children,
	program,
}: {
	children: ReactNode;
	program: SiteBehaviorProgramV1;
}) => (
	<KeyedBehaviorRuntimeBoundary key={JSON.stringify(program)} program={program}>
		{children}
	</KeyedBehaviorRuntimeBoundary>
);

const KeyedBehaviorRuntimeBoundary = ({
	children,
	program,
}: {
	children: ReactNode;
	program: SiteBehaviorProgramV1;
}) => {
	const runtime = useBehaviorRuntime({ program });

	return <BehaviorContext value={runtime}>{children}</BehaviorContext>;
};

export const BehaviorTrigger = ({
	children,
	disabledWhen,
	event,
	label,
	layout,
}: {
	children: ReactNode;
	disabledWhen?: string;
	event: string;
	label: string;
	layout?: Layout;
}) => {
	const runtime = useContext(BehaviorContext);
	const disabled = !runtime?.ready || Boolean(disabledWhen && runtime.outputs?.[disabledWhen] !== false);

	const activate = () => {
		if (!disabled) {
			runtime?.runEvent?.(event);
		}
	};

	return (
		<div
			aria-disabled={disabled || undefined}
			aria-label={label}
			className='iw-layout min-w-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-primary'
			onClick={activate}
			onKeyDown={(keyboardEvent) => {
				if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") {
					return;
				}

				keyboardEvent.preventDefault();
				activate();
			}}
			role='button'
			style={{ "--iw-default-display": "block", ...layoutStyle(layout) }}
			tabIndex={0}
		>
			{children}
		</div>
	);
};

export const BehaviorField = ({
	children,
	disabledWhen,
	emptyValue,
	invalid,
	layout,
	placeholder,
	slot,
}: {
	children: ReactNode;
	disabledWhen?: string;
	emptyValue?: string;
	invalid?: string;
	layout?: Layout;
	placeholder?: string;
	slot: string;
}) => {
	const runtime = useContext(BehaviorContext);
	const disabled = !runtime?.ready || Boolean(disabledWhen && runtime.outputs?.[disabledWhen] !== false);
	const [raw, setRaw] = useState(runtime?.slots[slot] ?? "");
	const normalized = normalizeBehaviorDecimalInput(raw);

	const valid =
		normalized === "" ? emptyValue !== undefined : normalized.length <= 400 && decimalValuePattern.test(normalized);

	const inputId = useId();
	const errorId = useId();

	return (
		<div
			className='iw-layout min-w-0 self-start gap-2 font-body text-foreground-primary'
			style={{ "--iw-default-display": "grid", ...layoutStyle(layout) }}
		>
			<label htmlFor={inputId}>{children}</label>
			<input
				aria-describedby={runtime && !valid && invalid ? errorId : undefined}
				aria-invalid={runtime ? !valid : undefined}
				className='min-h-12 w-full self-start rounded-website border border-border-subtle bg-surface-canvas px-4 py-3 text-base text-foreground-primary tabular-nums outline-none transition-[border-color,box-shadow] focus-visible:border-action-primary focus-visible:ring-2 focus-visible:ring-action-primary/20 aria-[invalid=true]:border-foreground-primary/40'
				disabled={disabled}
				id={inputId}
				inputMode='decimal'
				maxLength={400}
				onChange={(event) => {
					const value = event.currentTarget.value;
					const next = normalizeBehaviorDecimalInput(value);
					setRaw(value);

					if (next === "" && emptyValue !== undefined) {
						runtime?.updateSlot(slot, emptyValue);
					}

					if (next.length <= 400 && decimalValuePattern.test(next)) {
						runtime?.updateSlot(slot, next);
					}
				}}
				placeholder={placeholder}
				value={raw}
			/>
			{runtime && !valid && invalid ? (
				<span className='text-sm text-foreground-muted' id={errorId} role='alert'>
					{invalid}
				</span>
			) : null}
		</div>
	);
};

export const BehaviorValue = ({
	children,
	emphasis = "primary",
	format,
	layout,
	locale,
	unavailable,
	value,
}: {
	children: ReactNode;
	emphasis?: "primary" | "secondary";
	format: SiteBehaviorValueFormatV1;
	layout?: Layout;
	locale: string;
	unavailable: string;
	value: string;
}) => {
	const runtime = useContext(BehaviorContext);
	const result = runtime?.outputs?.[value] ?? null;
	const decimalResult = decimalValueSchema.safeParse(result);

	const formatted = decimalResult.success
		? formatExactDecimal({ format, locale, value: decimalResult.data })
		: unavailable;

	return (
		<output
			aria-live='polite'
			className={cn(
				"iw-layout min-w-0 border-s text-foreground-primary",
				emphasis === "primary" ? "gap-1.5 border-action-primary" : "gap-1 border-border-subtle"
			)}
			style={{
				"--iw-default-display": "grid",
				...layoutStyle({
					padding:
						emphasis === "primary"
							? { blockEnd: "0.75rem", blockStart: "0.75rem", inlineStart: "1.25rem" }
							: { blockEnd: "0.5rem", blockStart: "0.5rem", inlineStart: "1rem" },
					...layout,
				}),
			}}
		>
			<span className={cn("text-foreground-muted", emphasis === "secondary" && "text-sm")}>{children}</span>
			<strong
				className={cn(
					"font-brand tracking-tight tabular-nums [font-weight:var(--website-heading-weight)]",
					emphasis === "primary" ? "text-4xl" : "text-2xl"
				)}
			>
				{formatted}
			</strong>
		</output>
	);
};
