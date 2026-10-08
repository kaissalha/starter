"use client";

import { useEffect, useEffectEvent, useState } from "react";

type Autoplay = { intervalMs: number; pauseOnHover?: boolean; startDelayMs?: number };

type Item = { disabled?: boolean; value: string };

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

export type AutoplayPhase = "idle" | "off" | "paused" | "running";

const nextValue = ({ items, value }: { items: Array<Item>; value: string }) => {
	const enabled = items.filter((item) => !item.disabled);
	const index = enabled.findIndex((item) => item.value === value);

	return enabled[(index + 1) % enabled.length]?.value ?? value;
};

const resolvePhase = ({
	enabled,
	environment,
	paused,
}: {
	enabled: boolean;
	environment: { motion: boolean; ready: boolean };
	paused: boolean;
}): AutoplayPhase => {
	if (!enabled || (environment.ready && !environment.motion)) {
		return "off";
	}

	if (!environment.ready) {
		return "idle";
	}

	return paused ? "paused" : "running";
};

export const useTabsAutoplay = ({
	autoplay,
	defaultValue,
	items,
}: {
	autoplay?: Autoplay;
	defaultValue?: string;
	items: Array<Item>;
}) => {
	const [value, setValue] = useState(defaultValue ?? items.find((item) => !item.disabled)?.value ?? "");
	const [root, setRoot] = useState<HTMLDivElement | null>(null);
	const [hovered, setHovered] = useState(false);
	const [environment, setEnvironment] = useState({ motion: false, ready: false, visible: false });
	const enabled = autoplay !== undefined && items.length > 1;
	const interval = autoplay?.intervalMs;
	const delay = autoplay?.startDelayMs ?? 0;
	const pausable = autoplay?.pauseOnHover === true;

	const phase = resolvePhase({
		enabled,
		environment,
		paused: !environment.visible || (pausable && hovered),
	});

	const advance = useEffectEvent(() => setValue((current) => nextValue({ items, value: current })));

	useEffect(() => {
		if (!enabled || !root) {
			return;
		}

		const media = window.matchMedia(reducedMotionQuery);
		const syncMotion = () => setEnvironment((current) => ({ ...current, motion: !media.matches, ready: true }));

		const observer = new IntersectionObserver(
			([entry]) => setEnvironment((current) => ({ ...current, visible: entry?.isIntersecting ?? false })),
			{ threshold: 0.25 }
		);

		syncMotion();
		media.addEventListener("change", syncMotion);
		observer.observe(root);

		return () => {
			media.removeEventListener("change", syncMotion);
			observer.disconnect();
		};
	}, [enabled, root]);

	useEffect(() => {
		if (phase !== "running" || interval === undefined) {
			return;
		}

		const timeout = window.setTimeout(advance, interval + delay);

		return () => window.clearTimeout(timeout);
	}, [delay, interval, phase, value]);

	const hoverHandlers = pausable
		? {
				onBlur: () => setHovered(false),
				onFocus: () => setHovered(true),
				onPointerEnter: () => setHovered(true),
				onPointerLeave: () => setHovered(false),
			}
		: {};

	return { hoverHandlers, phase, setRoot, setValue, value };
};
