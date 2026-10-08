"use client";

import { useEffect, useState } from "react";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useReducedMotion } from "motion/react";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@starter/ui/components/button";

import { useInView } from "./use-in-view";

type HeroPromptProps = {
	cta: string;
	label: string;
	sentences: ReadonlyArray<string>;
};

type PromptState = { erasing: boolean; index: number; length: number };

const TYPE_MS = 42;

const HOLD_MS = 2600;

const ERASE_MS = 16;

const REST_MS = 400;

const step = (state: PromptState, full: number) => {
	if (state.erasing) {
		if (state.length === 0) {
			return { delay: REST_MS, next: { erasing: false, index: state.index + 1, length: 0 } };
		}

		return { delay: ERASE_MS, next: { ...state, length: state.length - 1 } };
	}

	if (state.length >= full) {
		return { delay: HOLD_MS, next: { ...state, erasing: true } };
	}

	return { delay: TYPE_MS, next: { ...state, length: state.length + 1 } };
};

export const HeroPrompt = ({ cta, label, sentences }: HeroPromptProps) => {
	const reduced = useReducedMotion();
	const router = useRouter();
	const { inView, ref } = useInView<HTMLFormElement>();
	const [draft, setDraft] = useState("");
	const [focused, setFocused] = useState(false);
	const [state, setState] = useState<PromptState>({ erasing: false, index: 0, length: 0 });
	const demo = !focused && draft === "";
	const sentence = sentences[state.index % sentences.length] ?? "";
	const text = reduced ? (sentences[0] ?? "") : sentence.slice(0, state.length);

	useEffect(() => {
		if (reduced || !demo || !inView) {
			return;
		}

		const { delay, next } = step(state, sentence.length);
		const timer = setTimeout(() => setState(next), delay);

		return () => clearTimeout(timer);
	}, [demo, inView, reduced, sentence, state]);

	return (
		<form
			className='mx-auto mt-10 flex w-full max-w-2xl flex-col gap-3 rounded-[28px] bg-white p-2 text-start ring-1 ring-olive-950/6 smooth-shadow-xl sm:flex-row sm:items-center sm:rounded-full'
			onSubmit={(event) => {
				event.preventDefault();

				try {
					sessionStorage.setItem("hero-prompt-draft", draft.trim().slice(0, 120));
				} catch {}

				router.push("/dashboard/website");
			}}
			ref={ref}
		>
			<label className='relative flex min-h-12 min-w-0 flex-1 items-center'>
				<span className='sr-only'>{label}</span>
				<input
					className='size-full min-h-12 bg-transparent px-4 text-base text-olive-950 outline-none sm:ps-6 sm:text-lg'
					onBlur={() => setFocused(false)}
					onChange={(event) => setDraft(event.target.value)}
					onFocus={() => setFocused(true)}
					value={draft}
				/>
				{demo ? (
					<span
						aria-hidden='true'
						className='pointer-events-none absolute inset-0 flex items-center overflow-hidden px-4 text-base whitespace-nowrap text-muted-foreground/64 sm:ps-6 sm:text-lg'
					>
						{text}
						<span className='ms-0.5 inline-block h-[1.1em] w-0.5 animate-pulse bg-olive-950 motion-reduce:hidden' />
					</span>
				) : null}
			</label>
			<Button className='w-full sm:w-auto' size='xl' type='submit'>
				{cta}
				<HugeiconsIcon
					aria-hidden='true'
					className='scale-110 rtl:-scale-x-110'
					data-icon='inline-end'
					icon={ArrowRight02Icon}
					strokeWidth={1.75}
				/>
			</Button>
		</form>
	);
};
