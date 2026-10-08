"use client";

import type { ReactNode } from "react";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

import { useLiquid } from "@starter/ui/hooks/use-liquid";
import type { Palette } from "@starter/ui/lib/liquid";
import { cn } from "@starter/ui/lib/utils";

export type SilkCardProps = {
	children?: ReactNode;
	className?: string;
	palette?: Palette;
	seed?: number;
	tilt?: number;
};

const backgrounds = {
	blue: "bg-brand-blue-night",
	green: "bg-brand-green-night",
	orange: "bg-brand-orange-night",
	purple: "bg-brand-purple-night",
	red: "bg-brand-red-night",
} satisfies Record<Palette, string>;

export const SilkCard = ({ children, className, palette = "blue", seed = 0, tilt = 8 }: SilkCardProps) => {
	const { canvas, liquid } = useLiquid({ palette, seed });

	const px = useMotionValue(0.5);
	const py = useMotionValue(0.5);
	const sx = useSpring(px, { damping: 26, stiffness: 220 });
	const sy = useSpring(py, { damping: 26, stiffness: 220 });
	const range = useReducedMotion() ? 0 : tilt;
	const rotateY = useTransform(sx, [0, 1], [-range, range]);
	const rotateX = useTransform(sy, [0, 1], [range, -range]);

	return (
		<motion.div
			className={cn(
				"relative isolate overflow-hidden rounded-[28px] text-white transform-3d",
				backgrounds[palette],
				className
			)}
			onPointerLeave={() => {
				px.set(0.5);
				py.set(0.5);
				liquid.current?.set({ mouse: [0.5, 0.5] });
			}}
			onPointerMove={(event) => {
				const rect = event.currentTarget.getBoundingClientRect();
				const x = (event.clientX - rect.left) / rect.width;
				const y = (event.clientY - rect.top) / rect.height;
				px.set(x);
				py.set(y);
				liquid.current?.set({ mouse: [x, 1 - y] });
			}}
			style={{ perspective: 1000, rotateX, rotateY }}
		>
			<canvas aria-hidden className='absolute inset-0 -z-10 size-full' ref={canvas} />
			<div className='pointer-events-none absolute inset-0 -z-10 bg-linear-to-t from-black/35 via-transparent to-black/10' />
			<div className='pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-white/15 ring-inset' />
			<div className='relative h-full'>{children}</div>
		</motion.div>
	);
};
