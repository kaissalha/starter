"use client";

import Image from "next/image";

import { useTranslations } from "next-intl";

import { MediaEditButton } from "@/components/media/media-edit-button";
import { Button } from "@starter/ui/components/button";
import { useSidebar } from "@starter/ui/components/sidebar";

export const BlogCoverEditor = ({
	alt,
	disabled,
	onEdit,
	src,
}: {
	alt: string;
	disabled: boolean;
	onEdit: () => void;
	src?: string;
}) => {
	const t = useTranslations("media");
	const { isMobile, setOpen, setOpenMobile } = useSidebar("details");

	const edit = () => {
		onEdit();

		if (isMobile) {
			setOpenMobile(true);
		} else {
			setOpen(true);
		}
	};

	return (
		<div className='relative my-8 overflow-hidden rounded-[var(--website-radius)]' data-blog-media-trigger=''>
			{src ? (
				<>
					<Image
						alt={alt}
						className='aspect-[16/9] w-full object-cover'
						height={675}
						src={src}
						unoptimized
						width={1200}
					/>
					<MediaEditButton disabled={disabled} label={alt} onClick={edit} />
				</>
			) : (
				<Button className='w-full' disabled={disabled} onClick={edit} variant='outline'>
					{t("choose")}
				</Button>
			)}
		</div>
	);
};
