import type * as React from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { ArrowRight01Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { cn } from "@starter/ui/lib/utils";

const Breadcrumb = ({ ...props }: React.ComponentProps<"nav">) => {
	return <nav aria-label='breadcrumb' data-slot='breadcrumb' {...props} />;
};

const BreadcrumbList = ({ className, ...props }: React.ComponentProps<"ol">) => {
	return (
		<ol
			className={cn(
				"flex flex-wrap items-center gap-1.5 text-sm wrap-break-word text-muted-foreground sm:gap-2.5",
				className
			)}
			data-slot='breadcrumb-list'
			{...props}
		/>
	);
};

const BreadcrumbItem = ({ className, ...props }: React.ComponentProps<"li">) => {
	return <li className={cn("inline-flex items-center gap-1.5", className)} data-slot='breadcrumb-item' {...props} />;
};

const BreadcrumbLink = ({ className, render, ...props }: useRender.ComponentProps<"a">) => {
	const defaultProps = {
		className: cn("transition-colors hover:text-foreground", className),
		"data-slot": "breadcrumb-link",
	};

	return useRender({
		defaultTagName: "a",
		props: mergeProps<"a">(defaultProps, props),
		render,
	});
};

const BreadcrumbPage = ({ className, ...props }: React.ComponentProps<"span">) => {
	return (
		<span
			aria-current='page'
			className={cn("font-normal text-foreground", className)}
			data-slot='breadcrumb-page'
			{...props}
		/>
	);
};

const BreadcrumbSeparator = ({ children, className, ...props }: React.ComponentProps<"li">) => {
	return (
		<li
			aria-hidden='true'
			className={cn("opacity-72 [&>svg]:size-4", className)}
			data-slot='breadcrumb-separator'
			role='presentation'
			{...props}
		>
			{children ?? (
				<HugeiconsIcon aria-hidden='true' className='scale-110' icon={ArrowRight01Icon} strokeWidth={1.75} />
			)}
		</li>
	);
};

const BreadcrumbEllipsis = ({ className, ...props }: React.ComponentProps<"span">) => {
	return (
		<span aria-hidden='true' className={className} data-slot='breadcrumb-ellipsis' role='presentation' {...props}>
			<HugeiconsIcon
				aria-hidden='true'
				className='size-4 scale-110'
				icon={MoreHorizontalIcon}
				strokeWidth={1.75}
			/>
			<span className='sr-only'>More</span>
		</span>
	);
};

export {
	Breadcrumb,
	BreadcrumbList,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbPage,
	BreadcrumbSeparator,
	BreadcrumbEllipsis,
};
