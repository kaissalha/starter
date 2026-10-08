import type { Foreground, Layout, SiteNodeDefinition, TypographyAppearance } from "../../../document/structure-schema";
import { textNode } from "../../call-to-action/_shared/parts";
import type { SectionRepeater } from "../../section-definition";

export const divider = () => {
	return {
		layout: { blockSize: "1px", inlineSize: "full" },
		props: { children: [], decorative: true, fill: "border" },
		type: "box",
	} satisfies SiteNodeDefinition;
};

type DisclosureNode = Extract<SiteNodeDefinition, { type: "disclosure" }>;

type DisclosureItem = DisclosureNode["props"]["items"][number];

type DisclosureOptions = Partial<Omit<DisclosureNode["props"], "items">>;

export const dividedList = ({
	items,
	layout,
	leading = true,
	...options
}: DisclosureOptions & { items?: Array<DisclosureItem>; layout?: Layout; leading?: boolean }) => {
	return {
		layout: { inlineSize: "full", ...layout },
		props: {
			children: [
				...(leading ? [divider()] : []),
				{ layout: { inlineSize: "full" }, props: { ...options, items: items ?? [] }, type: "disclosure" },
			],
			direction: "column",
		},
		type: "flex",
	} satisfies SiteNodeDefinition;
};

export const icon = ({
	name,
	size = "4sp",
	tone = "primary",
}: {
	name: "chevron-down" | "plus";
	size?: string;
	tone?: Foreground;
}) => {
	return { props: { name, size, tone }, type: "icon" } satisfies SiteNodeDefinition;
};

export const itemQuestion = ({
	appearance,
	index,
	tone = "primary",
}: {
	appearance: TypographyAppearance;
	index: number;
	tone?: Foreground;
}) => {
	return textNode({
		appearance,
		element: "span",
		layout: { grow: 1 },
		pointer: `/items/items/${index}/question`,
		tone,
	});
};

export const itemAnswer = ({
	appearance,
	index,
	layout,
	tone = "muted",
}: {
	appearance: TypographyAppearance;
	index: number;
	layout?: Layout;
	tone?: Foreground;
}) => {
	return textNode({ appearance, layout, pointer: `/items/items/${index}/answer`, tone });
};

export const disclosureItem = ({
	align = "center",
	answer,
	gap = "4sp",
	panelPadding,
	rowPadding,
	trigger,
}: {
	align?: "center" | "start";
	answer: SiteNodeDefinition;
	gap?: string;
	panelPadding?: Layout["padding"];
	rowPadding?: Layout["padding"];
	trigger: Array<SiteNodeDefinition>;
}) => {
	return {
		panel: [
			{
				layout: panelPadding ? { padding: panelPadding } : {},
				props: { children: [answer], direction: "column" },
				type: "flex",
			},
		],
		trigger: [
			{
				layout: { inlineSize: "full", ...(rowPadding && { padding: rowPadding }) },
				props: { align, children: trigger, direction: "row", gap },
				type: "flex",
			},
		],
	} satisfies DisclosureItem;
};

export const itemRepeater = ({
	createValues,
	initial,
	max = 10,
	target,
}: {
	createValues: SectionRepeater["createValues"];
	initial: number;
	max?: number;
	target: string;
}) => {
	return { collection: "/items", createValues, initial, max, min: 1, target } satisfies SectionRepeater;
};
