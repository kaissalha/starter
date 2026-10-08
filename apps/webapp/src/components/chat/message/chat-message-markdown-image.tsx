"use client";

import { use, useState, type ComponentProps } from "react";

import { Download01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { StreamdownContext, type ExtraProps } from "streamdown";

import { downloadContent } from "@/utils/download-content";
import { Button } from "@starter/ui/components/button";
import { cn } from "@starter/ui/lib/utils";

export const ChatMessageMarkdownImage = ({
	alt,
	className,
	node: _node,
	src,
	...props
}: ComponentProps<"img"> & ExtraProps) => {
	const t = useTranslations("components.chat.markdown");
	const { isAnimating } = use(StreamdownContext);
	const [downloading, setDownloading] = useState(false);

	if (!src || src instanceof Blob) {
		return null;
	}

	return (
		<span className='group group/button-reveal relative my-4 inline-block' data-streamdown='image-wrapper'>
			{/* oxlint-disable-next-line next/no-img-element -- Markdown images have no intrinsic dimensions or fixed container. */}
			<img alt={alt ?? ""} className={cn("max-w-full rounded-lg", className)} src={src} {...props} />
			<Button
				aria-label={t("downloadImage")}
				className='absolute end-2 top-2'
				disabled={isAnimating}
				loading={downloading}
				onClick={async () => {
					setDownloading(true);

					try {
						const response = await fetch(src);

						if (!response.ok) {
							throw new Error("Image download failed");
						}

						const content = await response.blob();
						const filename = new URL(src, window.location.href).pathname.split("/").pop() || "image";
						downloadContent({ content, filename, type: content.type });
					} catch {
						window.open(src, "_blank", "noopener,noreferrer");
					} finally {
						setDownloading(false);
					}
				}}
				revealOnHover
				size='icon-sm'
				variant='secondary'
			>
				<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Download01Icon} strokeWidth={1.75} />
			</Button>
		</span>
	);
};
