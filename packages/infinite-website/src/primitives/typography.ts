import { z } from "zod";

import { lengthSchema, type TextAppearance, type TypographyAppearance } from "../document/structure-schema";

type TypographyElement = "p" | "span" | "h1" | "h2" | "h3" | "h4";

const sizeStepByAppearance = {
	"body-lg": 1,
	"body-lg-em": 1,
	"body-md": 0,
	"body-md-em": 0,
	"body-sm": -1,
	"body-sm-em": -1,
	"body-xs": -2,
	"body-xs-em": -2,
	code: -1,
	"display-2xl": 10,
	"display-lg": 7,
	"display-md": 6,
	"display-sm": 5,
	"display-xl": 9,
	"display-xs": 4,
	"heading-lg": 4,
	"heading-md": 3,
	"heading-sm": 2,
	"heading-xs": 1,
	"label-lg": -1,
	"label-md": -2,
	"label-sm": -2,
	"title-lg": 2,
	"title-md": 1,
	"title-sm": 0,
	"title-xs": -1,
	watermark: "watermark",
} satisfies Record<TypographyAppearance, number | "watermark">;

const lineHeightByAppearance = {
	"body-lg": 1.25,
	"body-lg-em": 1.4,
	"body-md": 1.4,
	"body-md-em": 1.4,
	"body-sm": 1.5,
	"body-sm-em": 1.5,
	"body-xs": 1.2,
	"body-xs-em": 1.2,
	code: 1.4,
	"display-2xl": 1.1,
	"display-lg": 1.1,
	"display-md": 1.15,
	"display-sm": 1.15,
	"display-xl": 1.1,
	"display-xs": 1.1,
	"heading-lg": 1.1,
	"heading-md": 1.2,
	"heading-sm": 1.2,
	"heading-xs": 1.2,
	"label-lg": 1.35,
	"label-md": 1.4,
	"label-sm": 1.4,
	"title-lg": 1.2,
	"title-md": 1.25,
	"title-sm": 1.4,
	"title-xs": 1.2,
	watermark: 1.1,
} satisfies Record<TypographyAppearance, number>;

const weightByAppearance = {
	"body-lg": 400,
	"body-lg-em": 600,
	"body-md": 400,
	"body-md-em": 600,
	"body-sm": 400,
	"body-sm-em": 600,
	"body-xs": 400,
	"body-xs-em": 600,
	code: 400,
	"display-2xl": 700,
	"display-lg": 700,
	"display-md": 600,
	"display-sm": 600,
	"display-xl": 700,
	"display-xs": 600,
	"heading-lg": 600,
	"heading-md": 600,
	"heading-sm": 600,
	"heading-xs": 600,
	"label-lg": 500,
	"label-md": 500,
	"label-sm": 400,
	"title-lg": 600,
	"title-md": 600,
	"title-sm": 600,
	"title-xs": 600,
	watermark: 600,
} satisfies Record<TypographyAppearance, number | string>;

const trackingByAppearance = {
	"heading-lg": "-0.025em",
	"label-lg": "0.025em",
	"label-md": "0.025em",
} satisfies Partial<Record<TypographyAppearance, string>>;

const generateFluidFontSize = ({ step }: { step: number }) => {
	const minSize = 1.2 ** step;
	const maxSize = 1.25 * 1.25 ** step;
	const slope = (maxSize - minSize) / (80 - 22.5);
	const intercept = minSize - slope * 22.5;

	return `clamp(${minSize.toFixed(4)}rem, ${intercept.toFixed(4)}rem + ${(slope * 100).toFixed(4)}cqi, ${maxSize.toFixed(4)}rem)`;
};

const maximumFontSize = (fontSize: TextAppearance["fontSize"]) => {
	if (fontSize === undefined) {
		return 1;
	}

	const scalarFontSize = lengthSchema.safeParse(fontSize);

	if (scalarFontSize.success) {
		return scalarFontSize.data === 0 ? 1 : Number.parseFloat(String(scalarFontSize.data));
	}

	const responsiveFontSize = z
		.strictObject({
			base: lengthSchema,
			compact: lengthSchema.optional(),
			medium: lengthSchema.optional(),
			wide: lengthSchema.optional(),
		})
		.parse(fontSize);

	return Math.max(
		...Object.values(responsiveFontSize).flatMap((value) =>
			value === undefined || value === 0 ? [] : [Number.parseFloat(String(value))]
		)
	);
};

const isEmphasized = (weight: TextAppearance["weight"]) => {
	return weight === "medium" || weight === "semibold" || weight === "bold" || weight === "theme";
};

const inferHeadingAppearance = ({ size, tracking }: { size: number; tracking: TextAppearance["tracking"] }) => {
	if (size >= 5.5) {
		return "display-lg";
	}

	if (size >= 4.5) {
		return "display-md";
	}

	if (size >= 3.5) {
		return "display-sm";
	}

	if (size >= 2.8) {
		return tracking === undefined ? "display-xs" : "heading-lg";
	}

	if (size >= 2.2) {
		return "heading-md";
	}

	if (size >= 1.8) {
		return "heading-sm";
	}

	return "heading-xs";
};

const inferBodyAppearance = ({
	size,
	tracking,
	transform,
	weight,
}: {
	size: number;
	tracking: TextAppearance["tracking"];
	transform: TextAppearance["transform"];
	weight: TextAppearance["weight"];
}) => {
	if (size >= 2.8) {
		return "display-xs";
	}

	if (size >= 2.2) {
		return "heading-md";
	}

	if (size >= 1.8) {
		return "heading-sm";
	}

	if (size >= 1.4) {
		return isEmphasized(weight) ? "body-lg-em" : "body-lg";
	}

	if (size >= 1.15) {
		return isEmphasized(weight) ? "body-md-em" : "body-md";
	}

	if (tracking !== undefined || transform === "uppercase") {
		return size >= 0.95 ? "label-lg" : "label-md";
	}

	if (size >= 0.95) {
		return isEmphasized(weight) ? "body-sm-em" : "body-sm";
	}

	return isEmphasized(weight) ? "label-md" : "body-sm";
};

export const inferTypographyAppearance = ({
	appearance,
	element,
	fontSize,
	tracking,
	transform,
	weight,
}: Pick<TextAppearance, "appearance" | "fontSize" | "tracking" | "transform" | "weight"> & {
	element: TypographyElement;
}) => {
	if (appearance) {
		return appearance;
	}

	const size = maximumFontSize(fontSize);

	if (element.startsWith("h")) {
		return inferHeadingAppearance({ size, tracking });
	}

	return inferBodyAppearance({ size, tracking, transform, weight });
};

const typographyFamily = ({ appearance }: { appearance: TypographyAppearance }) => {
	if (appearance.startsWith("display") || appearance === "watermark") {
		return "var(--website-font-brand)";
	}

	if (appearance.startsWith("heading")) {
		return `var(--website-type-${appearance}-family, var(--website-font-body))`;
	}

	if (appearance === "code") {
		return "var(--website-font-mono)";
	}

	return "var(--website-font-body)";
};

export const typographyAppearanceStyle = ({ appearance }: { appearance: TypographyAppearance }) => {
	const step = sizeStepByAppearance[appearance];
	const fontSize = step === "watermark" ? "clamp(3rem, 18vw, 15rem)" : generateFluidFontSize({ step });
	const fontWeight = `var(--website-type-${appearance}-weight, ${weightByAppearance[appearance]})`;

	return {
		fontFamily: typographyFamily({ appearance }),
		fontSize: `var(--iw-text-font-size, ${fontSize})`,
		fontWeight: `var(--iw-text-font-weight, ${fontWeight})`,
		letterSpacing: `var(--website-type-${appearance}-tracking, ${
			Object.entries(trackingByAppearance).find(
				([trackingAppearance]) => trackingAppearance === appearance
			)?.[1] ?? "0em"
		})`,
		lineHeight: `var(--website-type-${appearance}-line-height, ${lineHeightByAppearance[appearance]})`,
	};
};
