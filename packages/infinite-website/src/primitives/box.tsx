import type { ReactNode } from "react";

import { cn } from "cn";

import type { Layout } from "../document/structure-schema";
import { appearance } from "./appearance";
import { layoutStyle } from "./layout";
import { RevealBox, type RevealHover } from "./reveal";
import type { NodeProps } from "./shared";

export const Box = ({
	background,
	border,
	children,
	decorative,
	fill,
	fillOpacity,
	foreground,
	hoverReveal,
	htmlAnchor,
	htmlId,
	layout,
	opacity,
	pattern,
	radius,
	reveal,
}: Omit<NodeProps<"box">, "children" | "hoverReveal"> & {
	children: ReactNode;
	hoverReveal?: RevealHover;
	htmlAnchor?: string;
	htmlId?: string;
	layout?: Layout;
}) => {
	const visual = appearance({ background, border, fill, fillOpacity, foreground, opacity, pattern, radius });

	if (reveal || hoverReveal) {
		return (
			<RevealBox
				className={cn("iw-layout iw-box", decorative && "pointer-events-none", visual.className)}
				decorative={decorative}
				hoverReveal={hoverReveal}
				htmlAnchor={htmlAnchor}
				htmlId={htmlId}
				reveal={reveal}
				style={{
					...layoutStyle(hoverReveal ? { overflow: "hidden", position: "relative", ...layout } : layout),
					...visual.style,
				}}
			>
				{children}
			</RevealBox>
		);
	}

	return (
		<div
			aria-hidden={decorative || undefined}
			className={cn("iw-layout iw-box", decorative && "pointer-events-none", visual.className)}
			data-website-anchor={htmlAnchor}
			id={htmlId}
			style={{ ...layoutStyle(layout), ...visual.style }}
		>
			{children}
		</div>
	);
};
