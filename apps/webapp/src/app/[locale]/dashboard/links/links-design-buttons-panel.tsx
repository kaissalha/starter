"use client";

import { useTranslations } from "next-intl";

import type { BrandCornerStyle } from "@starter/infinite-brand";
import { linkPageButtonEffects, linkPageButtonStyles, type LinkPageAppearance } from "@starter/infinite-links";

import {
	buttonRadius,
	shadowOption,
	shadowOptions,
	shadowPatch,
	useBrandOverride,
	useDesignTheme,
	type ButtonStyle,
} from "./links-design-preview";
import { LinksLinkDesignPicker } from "./links-link-design-picker";
import {
	LinksColorList,
	LinksColorRow,
	LinksRatioSlider,
	LinksSegmented,
	LinksSelect,
	LinksToggle,
} from "./links-option-controls";
import { LinksFieldset, LinksPickerSection } from "./links-panel";
import type { LinksPageController } from "./use-links-page-controller";

type ButtonPatch = Partial<Omit<LinkPageAppearance["buttons"], "colors">>;

const accentColor = "#1b97f5";

const cornerStyleFor = (radius: number): BrandCornerStyle => {
	if (radius < 0.15) {
		return "square";
	}

	if (radius < 0.45) {
		return "subtle";
	}

	return radius < 0.75 ? "rounded" : "soft";
};

const useButtonsEditor = (controller: LinksPageController) => {
	const theme = useDesignTheme(controller);
	const { buttons } = controller.document.appearance;
	const radius = buttonRadius({ buttons, controller });
	const buttonColor = buttons.colors.button ?? theme.colors.action;

	const textFallbacks = {
		glass: theme.colors.foreground,
		outline: buttonColor,
		soft: theme.colors.onAction,
		solid: theme.colors.onAction,
	} satisfies Record<ButtonStyle, string>;

	return {
		buttons,
		radius,
		textFallback: textFallbacks[buttons.style],
		theme,
		update: (patch: ButtonPatch) => controller.updateButtons({ radius, ...patch }),
	};
};

const StyleFields = ({ controller }: { controller: LinksPageController }) => {
	const t = useTranslations("links.design");
	const { buttons, update } = useButtonsEditor(controller);

	return (
		<LinksFieldset legend={t("buttonStyle")}>
			<LinksSegmented
				hideLabel
				label={t("buttonStyle")}
				onChange={(style) => update({ style })}
				options={linkPageButtonStyles.map((style) => ({ label: t(`buttonStyles.${style}`), value: style }))}
				value={buttons.style === "soft" ? "solid" : buttons.style}
			/>
			<LinksSelect
				label={t("buttonEffect")}
				onChange={(effect) => update({ effect })}
				options={linkPageButtonEffects.map((effect) => ({
					label: t(`buttonEffects.${effect}`),
					value: effect,
				}))}
				value={buttons.effect ?? "none"}
			/>
			<LinksToggle
				checked={buttons.showImages === true}
				label={t("buttonImages")}
				onChange={(showImages) => update({ showImages })}
			/>
			<LinksToggle
				checked={buttons.textTransform === "uppercase"}
				label={t("buttonUppercase")}
				onChange={(uppercase) => update({ textTransform: uppercase ? "uppercase" : "none" })}
			/>
		</LinksFieldset>
	);
};

const SurfaceFields = ({ controller }: { controller: LinksPageController }) => {
	const t = useTranslations("links.design");
	const updateOverride = useBrandOverride(controller);
	const { buttons, radius, update } = useButtonsEditor(controller);
	const strength = buttons.shadowStrength ?? (buttons.shadow === "none" ? 0 : 1);

	return (
		<LinksFieldset legend={t("shape")}>
			<LinksRatioSlider
				label={t("cornerRadius")}
				onChange={(value) => {
					update({ radius: value });
					updateOverride({ cornerStyle: cornerStyleFor(value) });
				}}
				value={radius}
			/>
			<LinksRatioSlider
				label={t("borderWidth")}
				onChange={(borderWidth) => update({ borderWidth })}
				value={buttons.borderWidth ?? 0}
			/>
			<LinksRatioSlider
				label={t("buttonSpacing")}
				onChange={(spacing) => update({ spacing })}
				value={buttons.spacing ?? 1 / 3}
			/>
			{buttons.style === "solid" && (
				<LinksRatioSlider
					label={t("buttonOpacity")}
					onChange={(opacity) => update({ opacity: Math.round(opacity * 100) })}
					value={(buttons.opacity ?? 100) / 100}
				/>
			)}
			<LinksSegmented
				label={t("shadow")}
				onChange={(option) => update(shadowPatch({ option, strength }))}
				options={shadowOptions.map((value) => ({ label: t(`shadows.${value}`), value }))}
				value={shadowOption(buttons.shadow)}
			/>
			{buttons.shadow !== "none" && (
				<LinksRatioSlider
					label={t("shadowStrength")}
					onChange={(shadowStrength) => update({ shadowStrength })}
					value={strength}
				/>
			)}
		</LinksFieldset>
	);
};

const ColorFields = ({ controller }: { controller: LinksPageController }) => {
	const t = useTranslations("links.design");
	const { buttons, textFallback, theme } = useButtonsEditor(controller);

	return (
		<LinksFieldset legend={t("colors")}>
			<LinksColorList>
				<LinksColorRow
					fallback={theme.colors.action}
					label={t("buttonColor")}
					onChange={(button) => controller.updateButtonColors({ button })}
					value={buttons.colors.button}
				/>
				<LinksColorRow
					fallback={textFallback}
					label={t("buttonTextColor")}
					onChange={(text) => controller.updateButtonColors({ text })}
					value={buttons.colors.text}
				/>
				{buttons.shadow === "hard" && (
					<LinksColorRow
						fallback={theme.colors.foreground}
						label={t("shadowColor")}
						onChange={(shadow) => controller.updateButtonColors({ shadow })}
						value={buttons.colors.shadow}
					/>
				)}
				{(buttons.borderWidth ?? 0) > 0 && (
					<LinksColorRow
						fallback={theme.colors.foreground}
						label={t("borderColor")}
						onChange={(border) => controller.updateButtonColors({ border })}
						value={buttons.colors.border ?? null}
					/>
				)}
				<LinksColorRow
					fallback={accentColor}
					label={t("badgeColor")}
					onChange={(label) => controller.updateButtonColors({ label })}
					value={buttons.colors.label ?? null}
				/>
				<LinksColorRow
					fallback='#ffffff'
					label={t("badgeTextColor")}
					onChange={(labelText) => controller.updateButtonColors({ labelText })}
					value={buttons.colors.labelText ?? null}
				/>
				<LinksColorRow
					fallback={accentColor}
					label={t("ctaColor")}
					onChange={(cta) => controller.updateButtonColors({ cta })}
					value={buttons.colors.cta ?? null}
				/>
				<LinksColorRow
					fallback='#ffffff'
					label={t("ctaTextColor")}
					onChange={(ctaText) => controller.updateButtonColors({ ctaText })}
					value={buttons.colors.ctaText ?? null}
				/>
			</LinksColorList>
		</LinksFieldset>
	);
};

export const LinksButtonsPanel = ({ controller }: { controller: LinksPageController }) => {
	const t = useTranslations("links.design");

	return (
		<>
			<LinksPickerSection title={t("buttonLayout")}>
				<LinksLinkDesignPicker
					controller={controller}
					onChange={(design) => controller.updateButtons({ design })}
					value={controller.document.appearance.buttons.design}
				/>
			</LinksPickerSection>
			<StyleFields controller={controller} />
			<SurfaceFields controller={controller} />
			<ColorFields controller={controller} />
		</>
	);
};
