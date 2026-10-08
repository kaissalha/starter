"use client";

import { useState, type ReactNode } from "react";

import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import { useMedia } from "use-media";

import { useLiquid } from "@starter/ui/hooks/use-liquid";
import type { Palette } from "@starter/ui/lib/liquid";
import { cn } from "@starter/ui/lib/utils";

export type ShaderIndexItem = {
	description: string;
	icon?: ReactNode;
	id: string;
	palette?: Palette;
	seed?: number;
	title: string;
};

export type ShaderIndexProps = {
	className?: string;
	heading?: ReactNode;
	items: ReadonlyArray<ShaderIndexItem>;
};

const palettes: ReadonlyArray<Palette> = ["blue", "purple", "red", "green", "orange"];

const icons = {
	blue: "text-brand-blue",
	green: "text-brand-green",
	orange: "text-brand-orange",
	purple: "text-brand-purple",
	red: "text-brand-red",
} satisfies Record<Palette, string>;

const spring = { damping: 32, mass: 0.9, stiffness: 300, type: "spring" } satisfies Transition;

const LiquidCanvas = ({ palette, seed }: { palette: Palette; seed: number }) => {
	const { canvas } = useLiquid({ palette, seed });

	return <canvas aria-hidden className='absolute inset-0 size-full' ref={canvas} />;
};

export const ShaderIndex = ({ className, heading, items }: ShaderIndexProps) => {
	const [active, setActive] = useState(0);
	const canHover = useMedia("(hover: hover) and (pointer: fine) and (min-width: 64rem)", true);
	const reducedMotion = useReducedMotion();
	const current = items.at(active);

	if (!current) {
		return null;
	}

	const palette = current.palette ?? palettes[active % palettes.length];
	const fade = reducedMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" as const };

	return (
		<div
			className={cn(
				"grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-16 lg:gap-y-12",
				className
			)}
		>
			{heading ? <div className='min-w-0'>{heading}</div> : null}
			<div className='relative aspect-square w-[min(220px,55vw)] justify-self-center overflow-hidden rounded-[28px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:w-[min(38rem,44vw)] lg:justify-self-end'>
				<LiquidCanvas palette={palette} seed={current.seed ?? active * 7.31} />
				<AnimatePresence mode='wait'>
					{current.icon ? (
						<motion.div
							animate={{ opacity: 1, scale: 1 }}
							className={cn(
								"absolute inset-[36%] flex items-center justify-center rounded-[22%] bg-white [&>svg]:size-[50%]",
								icons[palette]
							)}
							exit={{ opacity: 0, scale: 0.8 }}
							initial={{ opacity: 0, scale: 0.8 }}
							key={current.id}
							transition={fade}
						>
							{current.icon}
						</motion.div>
					) : null}
				</AnimatePresence>
			</div>
			<div className='min-w-0 lg:col-start-1'>
				<ul className='flex flex-col items-start'>
					{items.map((item, index) => {
						const isActive = active === index;

						return (
							<li className='w-full' key={item.id}>
								<button
									aria-expanded={isActive}
									className={cn(
										"block cursor-pointer rounded-md py-1 text-start text-4xl font-semibold tracking-[-0.03em] transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-5xl md:text-6xl lg:text-7xl rtl:tracking-normal",
										!isActive && "text-muted-foreground/40 hover:text-muted-foreground/70"
									)}
									onClick={() => setActive(index)}
									onFocus={(event) => {
										if (event.currentTarget.matches(":focus-visible")) {
											setActive(index);
										}
									}}
									onPointerEnter={(event) => {
										if (event.pointerType === "mouse" && canHover) {
											setActive(index);
										}
									}}
									type='button'
								>
									{item.title}
								</button>
								{canHover ? null : (
									<motion.div
										animate={{ height: isActive ? "auto" : 0, opacity: isActive ? 1 : 0 }}
										className='overflow-hidden'
										initial={false}
										transition={reducedMotion ? { duration: 0 } : spring}
									>
										<p className='max-w-md pt-1 pb-3 text-base leading-7 text-muted-foreground'>
											{item.description}
										</p>
									</motion.div>
								)}
							</li>
						);
					})}
				</ul>
				{canHover ? (
					<div className='relative mt-8 min-h-24 max-w-xl'>
						<AnimatePresence mode='wait'>
							<motion.p
								animate={{ opacity: 1, y: 0 }}
								className='text-xl leading-9 text-muted-foreground'
								exit={{ opacity: 0, y: -6 }}
								initial={{ opacity: 0, y: 6 }}
								key={current.id}
								transition={fade}
							>
								{current.description}
							</motion.p>
						</AnimatePresence>
					</div>
				) : null}
			</div>
		</div>
	);
};
