"use client";

import { useEffect, useRef } from "react";

import { createLiquid, type Liquid, type Palette } from "@starter/ui/lib/liquid";

export const useLiquid = ({ palette, seed }: { palette: Palette; seed: number }) => {
	const canvas = useRef<HTMLCanvasElement>(null);
	const liquid = useRef<Liquid | null>(null);
	const initial = useRef({ palette, seed });

	useEffect(() => {
		if (!canvas.current) {
			return;
		}

		liquid.current = createLiquid(canvas.current, initial.current);

		return () => {
			liquid.current?.destroy();
			liquid.current = null;
		};
	}, []);

	useEffect(() => {
		liquid.current?.set({ palette, seed });
	}, [palette, seed]);

	return { canvas, liquid };
};
