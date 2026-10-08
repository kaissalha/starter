import type { CSSProperties } from "react";

import type { CarouselNode, Layout, Length } from "../document/structure-schema";
import { layoutStyle, lengthToCss, setResponsiveValue } from "./layout";

type Props = CarouselNode["props"];

const slideBasisCss = ({ basis, exact }: { basis: Length; exact: boolean }) => {
	const css = lengthToCss(basis);

	if (css === "auto" || exact) {
		return css;
	}

	const percent = /^(\d+(?:\.\d+)?)%$/u.exec(css);
	const share = percent ? 1 - Number(percent[1]) / 100 : 1;

	return `calc(${css} - ${share} * var(--iw-active-slide-gap, 0px))`;
};

export const slideStyle = ({
	active,
	axis,
	flat,
	props,
}: {
	active: boolean;
	axis: "x" | "y";
	flat: boolean;
	props: Pick<Props, "inactiveOpacity" | "inactiveScale" | "slideBasis" | "slideEffect" | "slideSizing">;
}) => {
	const aspectRatio = props.slideEffect?.aspectRatio;
	const spacing = flat ? 0 : "var(--iw-active-slide-gap, 0px)";

	const style: CSSProperties = {
		"--iw-slide-inactive-scale": active || props.inactiveScale === undefined ? 1 : props.inactiveScale,
		flexGrow: 0,
		flexShrink: 0,
		opacity: active || props.inactiveOpacity === undefined ? 1 : props.inactiveOpacity,
	};

	if (axis === "y") {
		style.marginBlockEnd = spacing;
	} else {
		style.marginInlineEnd = spacing;
	}

	if (aspectRatio) {
		style.alignItems = "center";
		style.aspectRatio = String(aspectRatio.center);
		style.display = "flex";
		style.justifyContent = "center";
	}

	setResponsiveValue({
		name: "slide-basis",
		serialize: (basis) => slideBasisCss({ basis, exact: props.slideSizing === "exact" }),
		style,
		value: props.slideBasis,
	});

	return style;
};

export const trackStyle = ({
	axis,
	props,
}: {
	axis: "x" | "y";
	props: Pick<Props, "gap" | "slideEffect" | "trackLayout">;
}) => {
	const style: CSSProperties = {
		...layoutStyle({ inlineSize: "full", ...props.trackLayout }),
		"--iw-default-display": "flex",
		alignItems: props.slideEffect?.aspectRatio ? "center" : undefined,
		flexDirection: axis === "y" ? "column" : undefined,
		gap: 0,
	};

	setResponsiveValue({ name: "slide-gap", serialize: lengthToCss, style, value: props.gap ?? "1rem" });

	return style;
};

export const rootStyle = ({
	controlsGap,
	layout,
}: {
	controlsGap: Props["controlsGap"];
	layout: Layout | undefined;
}) => {
	const style: CSSProperties = { ...layoutStyle(layout), "--iw-default-display": "flex" };

	setResponsiveValue({ name: "flex-gap", serialize: lengthToCss, style, value: controlsGap ?? "3rem" });

	return style;
};

export const viewportStyle = ({
	axis,
	edgeFade,
	viewportLayout,
}: {
	axis: "x" | "y";
	edgeFade: Props["edgeFade"];
	viewportLayout: Layout | undefined;
}) => {
	const style: CSSProperties = layoutStyle({
		inlineSize: { base: "100cqw", medium: "full" },
		margin: {
			base: { inlineEnd: "-1.5rem", inlineStart: "-1.5rem" },
			medium: { inlineEnd: 0, inlineStart: 0 },
		},
		overflow: "hidden",
		...viewportLayout,
	});

	if (edgeFade) {
		const size = edgeFade.size === undefined ? "8%" : lengthToCss(edgeFade.size);
		const direction = axis === "y" ? "to bottom" : "to right";
		const mask = `linear-gradient(${direction}, transparent 0, #000 ${size}, #000 calc(100% - ${size}), transparent 100%)`;
		style.maskImage = mask;
		style.WebkitMaskImage = mask;
	}

	return style;
};
