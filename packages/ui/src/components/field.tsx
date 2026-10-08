"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { cva } from "class-variance-authority";

import { Input } from "@starter/ui/components/input";
import { cn } from "@starter/ui/lib/utils";

const fieldVariants = cva("flex flex-col items-start gap-2", { variants: { size: { default: null, lg: "gap-6" } } });

const fieldLabelVariants = cva("inline-flex items-center gap-2 text-sm/4", {
	variants: { size: { default: null, lg: "text-2xl leading-8 font-medium tracking-tight" } },
});

const Field = ({ className, size = "default", ...props }: FieldPrimitive.Root.Props & { size?: "default" | "lg" }) => {
	return <FieldPrimitive.Root className={cn(fieldVariants({ size }), className)} data-slot='field' {...props} />;
};

const FieldLabel = ({
	className,
	size = "default",
	...props
}: FieldPrimitive.Label.Props & { size?: "default" | "lg" }) => {
	return (
		<FieldPrimitive.Label
			className={cn(fieldLabelVariants({ size }), className)}
			data-slot='field-label'
			{...props}
		/>
	);
};

const FieldDescription = ({ className, ...props }: FieldPrimitive.Description.Props) => {
	return (
		<FieldPrimitive.Description
			className={cn("text-xs text-muted-foreground", className)}
			data-slot='field-description'
			{...props}
		/>
	);
};

const FieldError = ({ className, ...props }: FieldPrimitive.Error.Props) => {
	return (
		<FieldPrimitive.Error
			className={cn("text-xs text-destructive-foreground", className)}
			data-slot='field-error'
			{...props}
		/>
	);
};

const FieldValidity = FieldPrimitive.Validity;

export { Field, FieldLabel, Input as FieldControl, FieldDescription, FieldError, FieldValidity };
