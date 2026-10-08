import type * as React from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { ArrowLeft01Icon, ArrowRight01Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { type Button, buttonVariants } from "@starter/ui/components/button";
import { cn } from "@starter/ui/lib/utils";

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => {
	return (
		<nav
			aria-label='pagination'
			className={cn("mx-auto flex w-full justify-center", className)}
			data-slot='pagination'
			{...props}
		/>
	);
};

const PaginationContent = ({ className, ...props }: React.ComponentProps<"ul">) => {
	return (
		<ul className={cn("flex flex-row items-center gap-1", className)} data-slot='pagination-content' {...props} />
	);
};

const PaginationItem = ({ ...props }: React.ComponentProps<"li">) => {
	return <li data-slot='pagination-item' {...props} />;
};

type PaginationLinkProps = {
	isActive?: boolean;
	size?: React.ComponentProps<typeof Button>["size"];
} & useRender.ComponentProps<"a">;

const PaginationLink = ({ className, isActive, render, size = "icon", ...props }: PaginationLinkProps) => {
	const defaultProps = {
		"aria-current": isActive ? ("page" as const) : undefined,
		className: render
			? className
			: cn(
					buttonVariants({
						size,
						variant: isActive ? "outline" : "ghost",
					}),
					className
				),
		"data-active": isActive,
		"data-slot": "pagination-link",
	};

	return useRender({
		defaultTagName: "a",
		props: mergeProps<"a">(defaultProps, props),
		render,
	});
};

const PaginationPrevious = ({ className, ...props }: React.ComponentProps<typeof PaginationLink>) => {
	return (
		<PaginationLink
			aria-label='Go to previous page'
			className={cn("max-sm:aspect-square max-sm:p-0", className)}
			size='default'
			{...props}
		>
			<HugeiconsIcon
				aria-hidden='true'
				className='sm:-ms-1 scale-110'
				icon={ArrowLeft01Icon}
				strokeWidth={1.75}
			/>
			<span className='max-sm:hidden'>Previous</span>
		</PaginationLink>
	);
};

const PaginationNext = ({ className, ...props }: React.ComponentProps<typeof PaginationLink>) => {
	return (
		<PaginationLink
			aria-label='Go to next page'
			className={cn("max-sm:aspect-square max-sm:p-0", className)}
			size='default'
			{...props}
		>
			<span className='max-sm:hidden'>Next</span>
			<HugeiconsIcon
				aria-hidden='true'
				className='sm:-me-1 scale-110'
				icon={ArrowRight01Icon}
				strokeWidth={1.75}
			/>
		</PaginationLink>
	);
};

const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<"span">) => {
	return (
		<span
			aria-hidden
			className={cn("flex min-w-7 justify-center", className)}
			data-slot='pagination-ellipsis'
			{...props}
		>
			<HugeiconsIcon
				aria-hidden='true'
				className='size-4 scale-110'
				icon={MoreHorizontalIcon}
				strokeWidth={1.75}
			/>
			<span className='sr-only'>More pages</span>
		</span>
	);
};

export {
	Pagination,
	PaginationContent,
	PaginationLink,
	PaginationItem,
	PaginationPrevious,
	PaginationNext,
	PaginationEllipsis,
};
