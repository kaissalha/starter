"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@starter/ui/lib/utils";

const websitePreviewScaleClassName = {
	quarter: "w-[400%] scale-[0.25]",
	sixTenths: "w-[166.667%] scale-[0.6]",
	threeTenths: "w-[333.333%] scale-[0.3]",
} as const;

const websitePreviewScale = {
	quarter: 0.25,
	sixTenths: 0.6,
	threeTenths: 0.3,
} as const;

export const WebsiteScaledPreview = ({
	children,
	className,
	fitContent = false,
	scale,
}: {
	children: ReactNode;
	className: string;
	fitContent?: boolean;
	scale: keyof typeof websitePreviewScaleClassName;
}) => {
	const [contentHeight, setContentHeight] = useState<number>();
	const content = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const node = content.current;

		if (!node || !fitContent || !window.ResizeObserver) {
			return;
		}

		const observer = new window.ResizeObserver(([entry]) => {
			if (entry) {
				setContentHeight(entry.contentRect.height);
			}
		});

		observer.observe(node);

		return () => observer.disconnect();
	}, [fitContent]);

	const fittedHeight =
		contentHeight === undefined
			? `calc-size(auto, size * ${websitePreviewScale[scale]})`
			: `${contentHeight * websitePreviewScale[scale]}px`;

	return (
		<div
			aria-hidden='true'
			className={cn("pointer-events-none overflow-hidden bg-background", className)}
			inert
			style={fitContent ? { height: fittedHeight } : undefined}
		>
			<div className={cn("origin-top-left", websitePreviewScaleClassName[scale])} ref={content}>
				{children}
			</div>
		</div>
	);
};
