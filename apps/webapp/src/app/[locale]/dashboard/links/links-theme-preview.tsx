"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

import {
	applyLinkPageTheme,
	defaultLinkPageAppearance,
	LinkPageRenderer,
	resolveLinkPageBrand,
	type LinkPageTheme,
} from "@starter/infinite-links";
import { Radio } from "@starter/ui/components/radio-group";

import type { LinksPageController } from "./use-links-page-controller";

export const LinksThemePreview = ({
	controller,
	theme,
}: {
	controller: LinksPageController;
	theme?: LinkPageTheme;
}) => {
	const document = theme
		? applyLinkPageTheme({ document: controller.document, theme })
		: { ...controller.document, appearance: defaultLinkPageAppearance };

	const brand = resolveLinkPageBrand({
		brandOverride: document.appearance.brandOverride,
		inheritedBrand: theme ? controller.brand : controller.state.inheritedBrand,
	});

	const [visible, setVisible] = useState(false);
	const frame = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		const node = frame.current;

		if (!node || visible) {
			return;
		}

		if (!window.IntersectionObserver) {
			const reveal = requestAnimationFrame(() => setVisible(true));

			return () => cancelAnimationFrame(reveal);
		}

		const observer = new window.IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) {
					setVisible(true);
				}
			},
			{ rootMargin: "50% 0px" }
		);

		observer.observe(node);

		return () => observer.disconnect();
	}, [visible]);

	return (
		<span
			aria-hidden='true'
			className='pointer-events-none relative block aspect-3/5 w-full overflow-hidden rounded-lg'
			inert
			ref={frame}
		>
			{visible && (
				<span className='absolute start-0 top-0 block w-[300%] origin-top-left scale-[0.333333] rtl:origin-top-right'>
					<LinkPageRenderer brand={brand} document={document} locale={controller.locale} preview />
				</span>
			)}
		</span>
	);
};

export const ThemeTile = ({
	children,
	name,
	style,
	value,
}: {
	children: ReactNode;
	name: string;
	style?: CSSProperties;
	value: string;
}) => {
	const nameId = useId();

	return (
		<label className='group/theme flex min-w-0 cursor-pointer flex-col gap-1.5'>
			<span
				className='relative flex flex-col items-center justify-center overflow-hidden rounded-lg bg-muted p-3 outline outline-border outline-offset-2 transition-[outline-color] group-focus-within/theme:outline-2 group-focus-within/theme:outline-ring group-has-data-checked/theme:outline-2 group-has-data-checked/theme:outline-foreground motion-reduce:transition-none'
				style={style}
			>
				<Radio aria-labelledby={nameId} value={value} variant='card' />
				{children}
			</span>
			<span
				className='truncate text-center text-xs font-medium text-muted-foreground group-has-data-checked/theme:text-foreground'
				id={nameId}
			>
				{name}
			</span>
		</label>
	);
};
