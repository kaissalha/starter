import type { Style } from "@react-pdf/types";

export type FormVariant = "underline" | "box" | "outlined" | "ghost";

export type FormLayout = "single" | "two-column" | "three-column";

export type FormLabelPosition = "above" | "left";

export type FormField = {
	height?: number;
	hint?: string;
	label: string;
	width?: number | string;
};

export type FormGroup = {
	fields: Array<FormField>;
	layout?: FormLayout;
	title?: string;
};

export type FormProps = {
	groups: Array<FormGroup>;
	labelPosition?: FormLabelPosition;
	noWrap?: boolean;
	style?: Style;
	subtitle?: string;
	title?: string;
	variant?: FormVariant;
};
