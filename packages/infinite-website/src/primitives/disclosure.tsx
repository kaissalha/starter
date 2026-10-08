"use client";

import type { CSSProperties, ReactNode } from "react";

import { Accordion } from "@base-ui/react/accordion";
import { cn } from "cn";

import type { Layout, Length, Responsive } from "../document/structure-schema";
import { layoutStyle, lengthToCss, setResponsiveValue } from "./layout";

type DisclosureItem = {
	controls?: ReactNode;
	id: string;
	panel: ReactNode;
	trigger: ReactNode;
};

const openIndicatorClass = {
	none: undefined,
	"rotate-180":
		"[&_.iw-icon]:transition-transform [&[data-panel-open]_.iw-icon]:rotate-180 motion-reduce:[&_.iw-icon]:transition-none",
	"rotate-45":
		"[&_.iw-icon]:transition-transform [&[data-panel-open]_.iw-icon]:rotate-45 motion-reduce:[&_.iw-icon]:transition-none",
};

export const Disclosure = ({
	defaultOpen = "none",
	divider = true,
	items,
	layout,
	multiple = false,
	openIndicator = "none",
	panelPadding,
	triggerPadding,
}: {
	defaultOpen?: "none" | "first";
	divider?: boolean | "between";
	items: Array<DisclosureItem>;
	layout?: Layout;
	multiple?: boolean;
	openIndicator?: keyof typeof openIndicatorClass;
	panelPadding?: Responsive<Length>;
	triggerPadding?: Responsive<Length>;
}) => {
	const style: CSSProperties = { ...layoutStyle(layout), "--iw-default-display": "flex" };
	setResponsiveValue({ name: "trigger-padding", serialize: lengthToCss, style, value: triggerPadding });
	setResponsiveValue({ name: "panel-padding", serialize: lengthToCss, style, value: panelPadding });

	return (
		<Accordion.Root
			className='iw-layout flex flex-col'
			defaultValue={defaultOpen === "first" && items[0] ? [items[0].id] : undefined}
			multiple={multiple}
			style={style}
		>
			{items.map((item) => (
				<Accordion.Item
					className={cn(
						"group/website-disclosure-item relative",
						divider === true && "border-b border-border-subtle",
						divider === "between" && "border-b border-border-subtle last:border-b-0"
					)}
					key={item.id}
					value={item.id}
				>
					<Accordion.Header className='m-0'>
						<Accordion.Trigger
							className={cn(
								"iw-disclosure-trigger group flex w-full cursor-pointer items-center justify-between gap-4 bg-transparent text-start",
								openIndicatorClass[openIndicator]
							)}
						>
							{item.trigger}
						</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Panel className='h-[var(--accordion-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none'>
						<div className='iw-disclosure-panel'>{item.panel}</div>
					</Accordion.Panel>
					{item.controls}
				</Accordion.Item>
			))}
		</Accordion.Root>
	);
};
