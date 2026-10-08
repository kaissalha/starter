import type { CSSProperties } from "react";

import { cn } from "cn";

import type { Layout, TabDecoration, TabDecorationScope } from "../document/structure-schema";
import { appearance } from "./appearance";
import { layoutStyle } from "./layout";

const inScope = ({ count, index, scope = "all" }: { count: number; index: number; scope?: TabDecorationScope }) => {
	if (scope === "first") {
		return index === 0;
	}

	if (scope === "last") {
		return index === count - 1;
	}

	if (scope === "not-first") {
		return index > 0;
	}

	return scope === "not-last" ? index < count - 1 : true;
};

const Decoration = ({ decoration }: { decoration: TabDecoration }) => {
	const visual = appearance(decoration.appearance ?? {});

	const sizing: Layout =
		decoration.kind === "ring" ? { blockSize: decoration.size, inlineSize: decoration.size } : {};

	const style: CSSProperties = {
		"--iw-deco-ms": decoration.transitionMs === undefined ? undefined : `${decoration.transitionMs}ms`,
		"--iw-default-display": "block",
		...layoutStyle({ position: "absolute", ...sizing, ...decoration.layout }),
		...visual.style,
	};

	if (decoration.kind === "ring") {
		const thickness = decoration.thickness ?? 6;

		return (
			<svg
				aria-hidden
				className={cn("iw-layout iw-tab-ring", visual.className)}
				data-source={decoration.source}
				style={style}
				viewBox='0 0 100 100'
			>
				<circle
					cx='50'
					cy='50'
					fill='none'
					pathLength={100}
					r={50 - thickness / 2}
					stroke='currentColor'
					strokeWidth={thickness}
				/>
			</svg>
		);
	}

	return (
		<span
			aria-hidden
			className={cn("iw-layout iw-tab-deco", visual.className)}
			data-axis={decoration.axis ?? "inline"}
			data-source={decoration.source}
			style={style}
		/>
	);
};

export const TabDecorations = ({
	count,
	decorations = [],
	index,
}: {
	count: number;
	decorations?: Array<TabDecoration>;
	index: number;
}) =>
	decorations
		.filter((decoration) => inScope({ count, index, scope: decoration.scope }))
		.map((decoration, position) => <Decoration decoration={decoration} key={`${decoration.kind}-${position}`} />);
