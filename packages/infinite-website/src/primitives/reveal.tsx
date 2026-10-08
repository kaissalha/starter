"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "cn";

import type { BoxAppearance, BoxScrollReveal } from "../document/structure-schema";
import { appearance } from "./appearance";

type RevealPhase = "visible" | "hidden" | "shown";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const useRevealPhase = ({ enabled, touchOnly = false }: { enabled: boolean; touchOnly?: boolean }) => {
	const [element, setElement] = useState<HTMLDivElement | null>(null);
	const [phase, setPhase] = useState<RevealPhase>("visible");

	useEffect(() => {
		if (!enabled || !element || prefersReducedMotion()) {
			return;
		}

		if (touchOnly && !window.matchMedia("(hover: none)").matches) {
			return;
		}

		const state = { armed: false };

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry) {
					return;
				}

				if (touchOnly) {
					setPhase(entry.intersectionRatio >= 0.5 ? "shown" : "hidden");

					return;
				}

				if (!state.armed) {
					state.armed = true;

					if (entry.isIntersecting) {
						observer.disconnect();
					} else {
						setPhase("hidden");
					}

					return;
				}

				if (entry.isIntersecting) {
					setPhase("shown");
					observer.disconnect();
				}
			},
			touchOnly ? { rootMargin: "-10% 0px -10% 0px", threshold: 0.5 } : { rootMargin: "0px 0px -8% 0px" }
		);

		observer.observe(element);

		return () => observer.disconnect();
	}, [element, enabled, touchOnly]);

	return { attach: setElement, phase };
};

export type RevealHover = {
	backdrop: ReactNode;
	coverAppearance: BoxAppearance;
	replacement: ReactNode;
	replacementForeground?: BoxAppearance["foreground"];
};

export const RevealBox = ({
	children,
	className,
	decorative,
	hoverReveal,
	htmlAnchor,
	htmlId,
	reveal,
	style,
}: {
	children: ReactNode;
	className: string;
	decorative?: boolean;
	hoverReveal?: RevealHover;
	htmlAnchor?: string;
	htmlId?: string;
	reveal?: BoxScrollReveal;
	style: CSSProperties;
}) => {
	const { attach: attachScroll, phase: scrollPhase } = useRevealPhase({ enabled: reveal !== undefined });

	const { attach: attachTouch, phase: touchPhase } = useRevealPhase({
		enabled: hoverReveal !== undefined,
		touchOnly: true,
	});

	const cover = appearance(hoverReveal?.coverAppearance ?? {});
	const replacement = appearance({ foreground: hoverReveal?.replacementForeground ?? "media" });

	if (!hoverReveal) {
		return (
			<div
				aria-hidden={decorative || undefined}
				className={cn(className, reveal && "iw-reveal")}
				data-animation={reveal?.animation}
				data-reveal={scrollPhase === "visible" ? undefined : scrollPhase}
				data-website-anchor={htmlAnchor}
				id={htmlId}
				ref={attachScroll}
				style={{
					...style,
					"--iw-reveal-delay": reveal?.delayMs === undefined ? undefined : `${reveal.delayMs}ms`,
					"--iw-reveal-ms": reveal?.durationMs === undefined ? undefined : `${reveal.durationMs}ms`,
				}}
			>
				{children}
			</div>
		);
	}

	return (
		<div
			aria-hidden={decorative || undefined}
			className={cn(className, "group/reveal isolate")}
			data-revealed={touchPhase === "shown" ? "" : undefined}
			data-website-anchor={htmlAnchor}
			id={htmlId}
			ref={attachTouch}
			style={style}
		>
			<div aria-hidden className='absolute inset-0 z-0'>
				{hoverReveal.backdrop}
			</div>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-0 z-[1] transition-transform duration-500 ease-in-out group-hover/reveal:-translate-y-full group-data-[revealed]/reveal:-translate-y-full motion-reduce:transition-none",
					cover.className
				)}
				style={cover.style}
			/>
			<div className='relative z-10 transition-opacity duration-500 group-hover/reveal:opacity-0 group-data-[revealed]/reveal:opacity-0 motion-reduce:transition-none'>
				{children}
			</div>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-0 z-10 transition-opacity duration-500 not-group-hover/reveal:not-group-data-[revealed]/reveal:opacity-0 motion-reduce:transition-none",
					replacement.className
				)}
				style={replacement.style}
			>
				{hoverReveal.replacement}
			</div>
		</div>
	);
};

export const ScrollWords = ({ content }: { content: string }) => {
	const [element, setElement] = useState<HTMLSpanElement | null>(null);

	const tokens = content
		.split(/(\s+)/u)
		.reduce<Array<{ part: string; word?: number }>>(
			(accumulator, part) => [
				...accumulator,
				part.trim() === ""
					? { part }
					: { part, word: accumulator.filter((token) => token.word !== undefined).length },
			],
			[]
		);

	const words = tokens.filter((token) => token.word !== undefined).length;

	useEffect(() => {
		if (!element || prefersReducedMotion()) {
			return;
		}

		const update = () => {
			const { height, top } = element.getBoundingClientRect();
			const viewport = window.innerHeight;
			const travel = 0.3 * viewport + height;
			const progress = travel > 0 ? (0.85 * viewport - top) / travel : 0;
			element.style.setProperty("--iw-reveal", String(Math.min(1, Math.max(0, progress))));
		};

		update();
		window.addEventListener("scroll", update, { passive: true });
		window.addEventListener("resize", update);

		return () => {
			window.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
		};
	}, [element]);

	return (
		<span ref={setElement} style={{ "--iw-words": words }}>
			{tokens.map(({ part, word }, index) =>
				word === undefined ? (
					part
				) : (
					<span className='iw-scroll-word' key={`${index}-${part}`} style={{ "--iw-word": word }}>
						{part}
					</span>
				)
			)}
		</span>
	);
};
