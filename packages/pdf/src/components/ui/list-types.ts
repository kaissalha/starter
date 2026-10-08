import type { Style } from "@react-pdf/types";

export type ListVariant = "bullet" | "numbered" | "checklist" | "icon" | "multi-level" | "descriptive";

export type ListItem = {
	checked?: boolean;
	children?: Array<ListItem>;
	description?: string;
	text: string;
};

export type ListProps = {
	_level?: number;
	gap?: "xs" | "sm" | "md";
	items: Array<ListItem>;
	noWrap?: boolean;
	style?: Style;
	variant?: ListVariant;
};
