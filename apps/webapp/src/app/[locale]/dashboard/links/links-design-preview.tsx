"use client";

import type { CSSProperties } from "react";

import type { BrandUpdate } from "@starter/infinite-brand";
import {
	projectLinkPageTheme,
	type linkPageButtonShadows,
	type LinkPageButtonAppearance,
} from "@starter/infinite-links";
import { cn } from "@starter/ui/lib/utils";

import type { LinksPageController } from "./use-links-page-controller";

export type ButtonStyle = LinkPageButtonAppearance["style"];

export type ButtonShadow = (typeof linkPageButtonShadows)[number];

export const cornerRatios = { rounded: 16 / 28, soft: 24 / 28, square: 0, subtle: 8 / 28 } as const;

export const shadowOptions = ["none", "soft", "hard"] as const;

export type ShadowOption = (typeof shadowOptions)[number];

export const shadowOption = (shadow: ButtonShadow): ShadowOption => {
	if (shadow === "none") {
		return "none";
	}

	return shadow === "hard" ? "hard" : "soft";
};

export const shadowPatch = ({ option, strength }: { option: ShadowOption; strength: number }) => {
	if (option === "none") {
		return { shadow: "none", shadowStrength: 0 } as const;
	}

	return { shadow: option === "hard" ? "hard" : "strong", shadowStrength: strength > 0 ? strength : 0.5 } as const;
};

export const buttonRadius = ({
	buttons,
	controller,
}: {
	buttons: LinkPageButtonAppearance;
	controller: LinksPageController;
}) => buttons.radius ?? cornerRatios[controller.brand.corners.style];

export const buttonStyleCss = ({
	background,
	button,
	foreground,
	opacity = 100,
	style,
}: {
	background: string;
	button: string;
	foreground: string;
	opacity?: number;
	style: ButtonStyle;
}): CSSProperties => {
	switch (style) {
		case "glass":
			return { backgroundColor: `${background}b3`, border: `1px solid ${foreground}33` };
		case "outline":
			return { border: `2px solid ${button}` };
		case "soft":
		case "solid":
			return { backgroundColor: `color-mix(in srgb, ${button} ${opacity}%, transparent)` };
	}
};

export const shadowCss = ({ shadow, shadowColor }: { shadow: ButtonShadow; shadowColor: string }) => {
	switch (shadow) {
		case "hard":
			return `4px 4px 0 0 ${shadowColor}`;
		case "none":
			return "none";
		case "strong":
			return "0 8px 20px rgb(0 0 0 / 0.26)";
		case "subtle":
			return "0 2px 8px rgb(0 0 0 / 0.14)";
	}
};

export const useDesignTheme = (controller: LinksPageController) =>
	projectLinkPageTheme({ appearance: controller.document.appearance, brand: controller.brand });

export const useBrandOverride = (controller: LinksPageController) => {
	const override = controller.document.appearance.brandOverride;
	const inherited = controller.state.inheritedBrand;

	return (update: BrandUpdate) =>
		controller.updateBrandOverride({
			colors: { ...inherited.colors, ...override?.colors, ...update.colors },
			cornerStyle: update.cornerStyle ?? override?.cornerStyle ?? inherited.corners.style,
			fontPairingId: update.fontPairingId ?? override?.fontPairingId,
		});
};

export const SampleButton = ({
	className,
	label,
	style,
}: {
	className?: string;
	label: string;
	style: CSSProperties;
}) => (
	<span
		className={cn("inline-flex min-h-11 min-w-36 items-center justify-center px-6 text-sm font-medium", className)}
		style={style}
	>
		{label}
	</span>
);
