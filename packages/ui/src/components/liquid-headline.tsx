"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";

import { createLiquid, type Liquid, type Palette } from "@starter/ui/lib/liquid";
import { cn } from "@starter/ui/lib/utils";

export type LiquidHeadlineProps = Omit<ComponentProps<"span">, "ref"> & {
	as?: "h1" | "h2" | "span";
	palette?: Palette;
	seed?: number;
	size?: "display" | "numeral" | "wordmark";
};

const sizes = {
	display:
		"text-[2.1rem] leading-[0.95] tracking-[-0.04em] min-[30rem]:text-5xl md:text-[3.4rem] min-[62rem]:text-[5rem] rtl:leading-[1.2] rtl:tracking-normal",
	numeral: "text-[3.25rem] leading-none tracking-[-0.04em] sm:text-[5rem] rtl:tracking-normal",
	wordmark: "font-brand text-[clamp(7rem,31vw,35rem)] leading-[0.8] tracking-[-0.07em]",
};

const paintText = (context: CanvasRenderingContext2D, element: HTMLElement, origin: DOMRect) => {
	const style = getComputedStyle(element);
	const alpha = Number.parseFloat(style.opacity) * Number.parseFloat(element.dataset.liquidAlpha ?? "1");

	if (alpha <= 0 || style.visibility === "hidden") {
		return;
	}

	context.save();
	const clip = element.closest<HTMLElement>("[data-liquid-clip]");

	if (clip) {
		const bounds = clip.getBoundingClientRect();
		context.beginPath();
		context.rect(bounds.left - origin.left, bounds.top - origin.top, bounds.width, bounds.height);
		context.clip();
	}

	context.globalAlpha = alpha;
	context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
	context.letterSpacing = style.letterSpacing;
	context.direction = style.direction === "rtl" ? "rtl" : "ltr";
	const metrics = context.measureText("Hg");
	const rect = element.getBoundingClientRect();

	const baseline =
		rect.top -
		origin.top +
		(rect.height - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 +
		metrics.fontBoundingBoxAscent;

	context.fillText(element.textContent ?? "", rect.left - origin.left, baseline);
	context.restore();
};

const paintMask = (mask: HTMLCanvasElement, wrapper: HTMLElement) => {
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	const width = Math.round(wrapper.clientWidth * dpr);
	const height = Math.round(wrapper.clientHeight * dpr);
	const context = mask.getContext("2d");

	if (!width || !height || !context) {
		return false;
	}

	mask.width = width;
	mask.height = height;
	context.scale(dpr, dpr);
	context.textAlign = "left";
	context.textBaseline = "alphabetic";
	context.fillStyle = "#000";
	const origin = wrapper.getBoundingClientRect();
	wrapper
		.querySelectorAll<HTMLElement>("[data-liquid-text]")
		.forEach((element) => paintText(context, element, origin));

	return true;
};

export const LiquidHeadline = ({
	as: Tag = "h1",
	children,
	className,
	palette = "blue",
	seed = 0,
	size = "display",
	...props
}: LiquidHeadlineProps) => {
	const wrapper = useRef<HTMLSpanElement>(null);
	const canvas = useRef<HTMLCanvasElement>(null);
	const liquid = useRef<Liquid | null>(null);
	const mask = useRef<HTMLCanvasElement | null>(null);
	const initial = useRef({ palette, seed });
	const [ready, setReady] = useState(false);

	useEffect(() => {
		if (!canvas.current || !wrapper.current) {
			return;
		}

		const instance = createLiquid(canvas.current, initial.current);

		if (!instance) {
			return;
		}

		liquid.current = instance;
		mask.current = document.createElement("canvas");
		const status = { disposed: false };
		const target = wrapper.current;

		const paint = () => {
			if (!status.disposed && mask.current && paintMask(mask.current, target)) {
				instance.setMask(mask.current);
				setReady(true);
			}
		};

		const paintWhenFontsLoad = async () => {
			await document.fonts.ready;
			paint();
		};

		paint();
		paintWhenFontsLoad();
		const observer = new ResizeObserver(paint);
		observer.observe(target);

		return () => {
			status.disposed = true;
			observer.disconnect();
			instance.destroy();
			liquid.current = null;
			setReady(false);
		};
	}, []);

	useEffect(() => {
		liquid.current?.set({ palette, seed });
	}, [palette, seed]);

	return (
		<span
			className='relative block'
			onPointerLeave={() => liquid.current?.set({ mouse: [0.5, 0.5] })}
			onPointerMove={(event) => {
				const rect = event.currentTarget.getBoundingClientRect();
				liquid.current?.set({
					mouse: [(event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height],
				});
			}}
			ref={wrapper}
		>
			<Tag className={cn("block font-semibold", sizes[size], className)} {...props}>
				{children}
			</Tag>
			<canvas
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-0 size-full opacity-0 transition-opacity duration-700 motion-reduce:transition-none",
					ready && "opacity-100"
				)}
				ref={canvas}
			/>
		</span>
	);
};
