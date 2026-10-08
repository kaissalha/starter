"use client";

import { useEffect, useState } from "react";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@starter/ui/lib/utils";

import { useInView } from "./use-in-view";

type RotatingHeadlineProps = {
	phrases: ReadonlyArray<string>;
	prefix: string;
};

const HOLD_MS = 2600;

const ease = [0.22, 1, 0.36, 1] as const;

const colors = ["text-brand-green-ink", "text-brand-blue-ink", "text-brand-orange-ink", "text-brand-red-ink"];

const targets = {
	active: { opacity: 1, y: "0%" },
	hidden: { opacity: 0, y: "120%" },
	leaving: { opacity: 0, y: "-120%" },
};

export const RotatingHeadline = ({ phrases, prefix }: RotatingHeadlineProps) => {
	const reduced = useReducedMotion();
	const { inView, ref } = useInView<HTMLHeadingElement>();
	const [state, setState] = useState({ index: 0, previous: -1 });

	useEffect(() => {
		if (!inView) {
			return;
		}

		const timer = setInterval(
			() =>
				setState((current) => ({
					index: (current.index + 1) % phrases.length,
					previous: current.index,
				})),
			HOLD_MS
		);

		return () => clearInterval(timer);
	}, [inView, phrases.length]);

	const statusOf = (phraseIndex: number) => {
		if (phraseIndex === state.index) {
			return "active";
		}

		return phraseIndex === state.previous ? "leaving" : "hidden";
	};

	return (
		<h1
			className='text-[2.1rem] leading-[0.95] font-semibold tracking-[-0.04em] min-[30rem]:text-5xl md:text-[3.4rem] min-[62rem]:text-[5rem] rtl:leading-[1.2] rtl:tracking-normal'
			ref={ref}
		>
			<span className='block text-olive-950'>{prefix}</span>
			<span className='block'>
				<span className='inline-grid pb-[0.1em] align-baseline [clip-path:inset(0)]'>
					{phrases.map((phrase, phraseIndex) => {
						const status = statusOf(phraseIndex);
						const words = phrase.split(" ");

						return (
							<span
								aria-hidden={status !== "active"}
								className={cn(
									"col-start-1 row-start-1 text-center whitespace-nowrap",
									colors[phraseIndex % colors.length]
								)}
								key={phrase}
							>
								{words.map((word, wordIndex) => (
									<motion.span
										animate={
											reduced ? { opacity: targets[status].opacity, y: "0%" } : targets[status]
										}
										className='inline-block'
										initial={false}
										key={`${wordIndex}-${word}`}
										transition={{
											delay: status === "active" ? wordIndex * 0.07 : wordIndex * 0.04,
											duration: reduced || status === "hidden" ? 0 : 0.55,
											ease,
										}}
									>
										{word}
										{wordIndex < words.length - 1 ? " " : ""}
									</motion.span>
								))}
							</span>
						);
					})}
				</span>
			</span>
		</h1>
	);
};
