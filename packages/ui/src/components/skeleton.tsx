import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const skeletonVariants = cva("bg-primary/10 animate-pulse rounded-md", {
	variants: { corners: { circle: "rounded-full", default: "", rounded: "rounded-xl", square: "rounded-none" } },
});

const Skeleton = ({
	className,
	corners = "default",
	...props
}: React.ComponentProps<"div"> & {
	corners?: "default" | "rounded" | "circle" | "square";
}) => {
	return <div className={cn(skeletonVariants({ corners }), className)} data-slot='skeleton' {...props} />;
};

export { Skeleton };
