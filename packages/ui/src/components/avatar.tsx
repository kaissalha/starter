"use client";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const avatarVariants = cva(
	"inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-background align-middle text-xs font-medium select-none",
	{
		variants: {
			corners: { circle: null, rounded: "rounded-lg" },
			size: { default: "", lg: "size-16 text-lg", xl: "size-20 text-xl" },
			variant: {
				default: null,
				outline:
					"border border-border bg-muted/40 text-muted-foreground [&_[data-slot=avatar-fallback]]:bg-transparent",
			},
		},
	}
);

const avatarImageVariants = cva("size-full object-cover", {
	variants: {
		animated: {
			true: "transition-[scale,opacity] duration-200 ease-[var(--ease-out-quint)] data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none",
		},
	},
});

const Avatar = ({
	className,
	corners = "circle",
	size = "default",
	variant = "default",
	...props
}: AvatarPrimitive.Root.Props & {
	corners?: "circle" | "rounded";
	size?: "default" | "lg" | "xl";
	variant?: "default" | "outline";
}) => {
	return (
		<AvatarPrimitive.Root
			className={cn(avatarVariants({ corners, size, variant }), className)}
			data-slot='avatar'
			{...props}
		/>
	);
};

const AvatarImage = ({
	animated = false,
	className,
	...props
}: AvatarPrimitive.Image.Props & { animated?: boolean }) => {
	return (
		<AvatarPrimitive.Image
			className={cn(avatarImageVariants({ animated }), className)}
			data-slot='avatar-image'
			{...props}
		/>
	);
};

const AvatarFallback = ({ className, ...props }: AvatarPrimitive.Fallback.Props) => {
	return (
		<AvatarPrimitive.Fallback
			className={cn("flex size-full items-center justify-center rounded-[inherit] bg-muted", className)}
			data-slot='avatar-fallback'
			{...props}
		/>
	);
};

export { Avatar, AvatarImage, AvatarFallback };
