import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const emptyVariants = cva(
	"flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-balance rounded-xl border-dashed p-6 text-center md:p-12",
	{ variants: { variant: { default: null, inline: "p-0 text-xs text-muted-foreground md:p-0" } } }
);

const Empty = ({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & {
	variant?: "default" | "inline";
}) => {
	return <div className={cn(emptyVariants({ variant }), className)} data-slot='empty' {...props} />;
};

const EmptyHeader = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn("flex max-w-sm flex-col items-center text-center", className)}
			data-slot='empty-header'
			{...props}
		/>
	);
};

const emptyMediaVariants = cva(
	"flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		defaultVariants: {
			variant: "default",
		},
		variants: {
			variant: {
				default: "bg-transparent",
				icon: "relative flex size-9 shrink-0 items-center justify-center rounded-md bg-card text-foreground shadow-black/5 smooth-shadow-ring-sm [&_svg:not([class*='size-'])]:size-4.5",
			},
		},
	}
);

const EmptyMedia = ({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) => {
	return (
		<div className={cn("relative mb-6", className)} data-slot='empty-media' data-variant={variant} {...props}>
			{variant === "icon" && (
				<>
					<div
						aria-hidden='true'
						className={cn(
							emptyMediaVariants({ className, variant }),
							"-translate-x-0.5 -rotate-10 pointer-events-none absolute inset-be-px origin-bottom-start scale-84 smooth-shadow-none rtl:translate-x-0.5"
						)}
					/>
					<div
						aria-hidden='true'
						className={cn(
							emptyMediaVariants({ className, variant }),
							"pointer-events-none absolute inset-be-px origin-bottom-end translate-x-0.5 rotate-10 scale-84 smooth-shadow-none rtl:-translate-x-0.5"
						)}
					/>
				</>
			)}
			<div className={cn(emptyMediaVariants({ className, variant }))} {...props} />
		</div>
	);
};

const EmptyTitle = ({ className, ...props }: React.ComponentProps<"div">) => {
	return <div className={cn("font-heading text-xl leading-none", className)} data-slot='empty-title' {...props} />;
};

const EmptyDescription = ({ className, ...props }: React.ComponentProps<"p">) => {
	return (
		<div
			className={cn(
				"text-muted-foreground text-sm/relaxed [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4 [[data-slot=empty-title]+&]:mt-1",
				className
			)}
			data-slot='empty-description'
			{...props}
		/>
	);
};

const EmptyContent = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn("flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm", className)}
			data-slot='empty-content'
			{...props}
		/>
	);
};

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };
