"use client";

import { ImageAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { Button, buttonVariants, type ButtonProps } from "@starter/ui/components/button";
import { cn } from "@starter/ui/lib/utils";

export const MediaEditButton = ({
	label,
	sectionScoped = false,
	...props
}: Omit<ButtonProps, "children"> & { label?: string; sectionScoped?: boolean }) => {
	const t = useTranslations("media");

	return (
		<Button
			aria-label={t("edit", { name: label ?? "" })}
			className='group/media-edit pointer-events-auto absolute inset-0 z-10 size-full @container'
			corners='inherit'
			type='button'
			unstyled
			{...props}
		>
			<span
				className={cn(
					"pointer-events-none absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/35 opacity-0 transition-opacity group-hover/media-edit:opacity-100 group-focus-visible/media-edit:opacity-100 motion-reduce:transition-none",
					sectionScoped
						? "[@media(pointer:coarse)]:group-focus-within/website-section:opacity-100"
						: "[@media(pointer:coarse)]:opacity-100"
				)}
			>
				<span className={buttonVariants({ variant: "outline" })}>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={ImageAdd01Icon} strokeWidth={1.75} />
					<span className='hidden @[9rem]:inline'>{t("editImage")}</span>
				</span>
			</span>
		</Button>
	);
};
