"use client";

import { useEffect, useRef, type RefObject } from "react";

import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { MorphIcon } from "morphicons/react";
import { useTranslations } from "next-intl";

import type { SiteSection } from "@starter/infinite-website";
import { Button } from "@starter/ui/components/button";

import type { WebsiteEditor } from "../use-website-editor";

export const WebsiteBlogVisibility = ({
	disabled,
	edit,
	hidden,
	renderedSection,
	root,
}: {
	disabled: boolean;
	edit: WebsiteEditor["edit"];
	hidden: boolean;
	renderedSection: SiteSection;
	root: RefObject<HTMLDivElement | null>;
}) => {
	const t = useTranslations("website.inlineEdit.menu");
	const control = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const header = root.current;
		const pill = control.current;

		if (!header || !pill) {
			return;
		}

		const synchronize = () => {
			const link = [...header.querySelectorAll<HTMLAnchorElement>('a[href="/blog"]')].find(
				(candidate) => candidate.getClientRects().length > 0
			);

			if (!link) {
				delete pill.dataset.positioned;

				return;
			}

			const bounds = header.getBoundingClientRect();
			const anchor = link.getBoundingClientRect();
			pill.style.left = `${anchor.left - bounds.left + anchor.width / 2}px`;
			pill.style.top = `${anchor.bottom - bounds.top}px`;
			pill.dataset.positioned = "";
		};

		synchronize();
		const observer = new ResizeObserver(synchronize);
		observer.observe(header);

		return () => observer.disconnect();
	}, [root, renderedSection.root]);

	return (
		<div
			className='invisible absolute z-[61] -translate-x-1/2 pt-1 opacity-0 transition-opacity duration-150 group-has-[[data-website-blog-link]:hover]/website-section:opacity-100 group-has-[[data-website-blog-link]:focus-visible]/website-section:opacity-100 hover:opacity-100 focus-within:opacity-100 data-[positioned]:visible motion-reduce:transition-none [@media(pointer:coarse)]:opacity-100'
			ref={control}
		>
			<Button
				aria-label={t(hidden ? "showBlog" : "hideBlog")}
				aria-pressed={!hidden}
				disabled={disabled}
				onClick={(event) => {
					event.stopPropagation();
					edit({ operation: "set-blog-navigation", visible: hidden });
				}}
				size='icon-xs'
				title={t(hidden ? "showBlog" : "hideBlog")}
				variant='secondary'
			>
				<MorphIcon
					className='scale-110'
					icon={hidden ? ViewOffIcon : ViewIcon}
					reducedMotion='user'
					strokeWidth={1.75}
				/>
			</Button>
		</div>
	);
};
