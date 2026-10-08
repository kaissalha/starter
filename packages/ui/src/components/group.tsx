import type * as React from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { Separator } from "@starter/ui/components/separator";
import { cn } from "@starter/ui/lib/utils";

const Group = ({ children, className, ...props }: { children: React.ReactNode; className?: string }) => {
	return (
		<div
			className={cn(
				"flex w-fit [--clip-end:-1rem] [--clip-start:-1rem] *:pointer-coarse:after:min-w-auto",
				className
			)}
			data-slot='group'
			role='group'
			{...props}
		>
			{children}
		</div>
	);
};

const GroupItem = ({ className, render, ...props }: useRender.ComponentProps<"div">) => {
	const defaultProps = {
		className: cn(
			"border-x-0 transition-[color,background-color,border-color] not-first:rounded-s-none not-last:rounded-e-none before:[clip-path:inset(-1rem_var(--clip-end)_-1rem_var(--clip-start))] not-first:before:-start-0.5 not-first:before:rounded-s-none not-first:before:[--clip-start:2px] not-last:before:-end-0.5 not-last:before:rounded-e-none not-last:before:[--clip-end:2px] first:border-s last:border-e not-last:has-[+[data-slot=separator]]:before:[--clip-end:1.5px] [[data-slot=separator]+&]:before:[--clip-start:1.5px]",
			className
		),
	};

	return useRender({
		defaultTagName: "div",
		props: mergeProps(defaultProps, props),
		render,
	});
};

const GroupSeparator = ({ className, ...props }: { className?: string }) => {
	return <Separator className={cn("relative z-20", className)} orientation='vertical' {...props} />;
};

export { Group, GroupItem, GroupSeparator };
