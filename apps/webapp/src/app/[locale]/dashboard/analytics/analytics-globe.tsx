"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import { useTheme } from "@wrksz/themes/client";
import createGlobe, { type Globe } from "cobe";
import { useReducedMotion } from "motion/react";

import type { CSSPropertiesWithVariables } from "@starter/ui/components/sidebar";
import { cn } from "@starter/ui/lib/utils";

export type GlobePoint = { count: number; id: string; label: string; latitude: number; longitude: number };

const tokenColor = (element: HTMLElement, token: string): [number, number, number] => {
	const probe = document.createElement("span");
	probe.style.color = `var(${token})`;
	element.append(probe);
	const context = document.createElement("canvas").getContext("2d");
	const color = getComputedStyle(probe).color;
	probe.remove();

	if (!context) {
		return [0.3, 0.4, 1];
	}

	context.fillStyle = color;
	context.fillRect(0, 0, 1, 1);
	const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data;

	return [red / 255, green / 255, blue / 255];
};

const facing = (longitude: number) => Math.PI - ((longitude * Math.PI) / 180 - Math.PI / 2);

const useGlobe = ({ dark, points }: { dark: boolean; points: Array<GlobePoint> }) => {
	const canvas = useRef<HTMLCanvasElement>(null);
	const globe = useRef<Globe>(null);
	const reduced = useReducedMotion();

	const markers = useEffectEvent(() =>
		points.map((point) => ({
			id: point.id,
			location: [point.latitude, point.longitude] satisfies [number, number],
			size: Math.min(0.1, 0.035 + Math.log2(point.count) * 0.015),
		}))
	);

	const initialPhi = useEffectEvent(() => facing(points[0]?.longitude ?? 10));
	useEffect(() => {
		const element = canvas.current;

		if (!element) {
			return;
		}

		const motion = { dragging: false, phi: initialPhi(), theta: 0.3, x: 0, y: 0 };
		const ratio = Math.min(2, window.devicePixelRatio || 1);
		const size = () => Math.max(1, element.offsetWidth * ratio);

		const instance = createGlobe(element, {
			baseColor: dark ? [0.22, 0.23, 0.26] : [1, 1, 1],
			dark: dark ? 1 : 0,
			devicePixelRatio: ratio,
			diffuse: dark ? 1.4 : 1.1,
			glowColor: dark ? [0.1, 0.11, 0.14] : [0.9, 0.91, 0.94],
			height: size(),
			mapBrightness: dark ? 5 : 2.5,
			mapSamples: 20_000,
			markerColor: tokenColor(element, "--primary"),
			markerElevation: 0.01,
			markers: markers(),
			opacity: 0.95,
			phi: motion.phi,
			theta: motion.theta,
			width: size(),
		});

		globe.current = instance;
		const resize = new ResizeObserver(() => instance.update({ height: size(), width: size() }));
		resize.observe(element);

		const down = (event: PointerEvent) => {
			Object.assign(motion, { dragging: true, x: event.clientX, y: event.clientY });
			element.setPointerCapture(event.pointerId);
		};

		const move = (event: PointerEvent) => {
			if (!motion.dragging) {
				return;
			}

			Object.assign(motion, {
				phi: motion.phi + (event.clientX - motion.x) / 160,
				theta: Math.max(-0.6, Math.min(0.9, motion.theta + (event.clientY - motion.y) / 320)),
				x: event.clientX,
				y: event.clientY,
			});
		};

		const up = () => {
			motion.dragging = false;
		};

		element.addEventListener("pointerdown", down);
		element.addEventListener("pointermove", move);
		element.addEventListener("pointerup", up);
		element.addEventListener("pointercancel", up);
		const frame = { id: 0 };

		const tick = () => {
			if (!motion.dragging && !reduced) {
				motion.phi += 0.0018;
			}

			instance.update({ phi: motion.phi, theta: motion.theta });
			frame.id = requestAnimationFrame(tick);
		};

		frame.id = requestAnimationFrame(tick);
		element.dataset.ready = "true";

		return () => {
			cancelAnimationFrame(frame.id);
			resize.disconnect();
			element.removeEventListener("pointerdown", down);
			element.removeEventListener("pointermove", move);
			element.removeEventListener("pointerup", up);
			element.removeEventListener("pointercancel", up);
			instance.destroy();
			globe.current = null;
		};
	}, [dark, reduced]);
	useEffect(() => {
		globe.current?.update({ markers: markers() });
	}, [points]);

	return canvas;
};

export const AnalyticsGlobe = ({
	className,
	label,
	points,
}: {
	className?: string;
	label: string;
	points: Array<GlobePoint>;
}) => {
	const { resolvedTheme } = useTheme();
	const canvas = useGlobe({ dark: resolvedTheme === "dark", points });

	return (
		<div className={cn("relative mx-auto aspect-square w-full", className)}>
			<canvas
				aria-label={label}
				className='size-full cursor-grab touch-pan-y opacity-0 transition-opacity duration-700 ease-out active:cursor-grabbing data-ready:opacity-100'
				ref={canvas}
				role='img'
			/>
			{points.map((point) => (
				<span
					className='pointer-events-none absolute hidden -translate-x-1/2 -translate-y-2 items-center gap-1.5 rounded-full bg-popover/90 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-popover-foreground opacity-(--visible) smooth-shadow-ring-md backdrop-blur-sm transition-opacity duration-300 [bottom:anchor(top)] [left:anchor(center)] [position-anchor:var(--anchor)] supports-[position-anchor:--a]:flex'
					key={point.id}
					style={
						{
							"--anchor": `--cobe-${point.id}`,
							"--visible": `var(--cobe-visible-${point.id}, 0)`,
						} satisfies CSSPropertiesWithVariables
					}
				>
					<span className='size-1.5 rounded-full bg-primary' />
					{point.label}
					{point.count > 1 && <span className='text-muted-foreground tabular-nums'>{point.count}</span>}
				</span>
			))}
		</div>
	);
};
