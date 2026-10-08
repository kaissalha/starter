"use client";

import type { CSSProperties } from "react";

import { useTranslations } from "next-intl";

import {
	linkPageButtonStyles,
	linkPageSectionStyles,
	type LinkPageBlock,
	type LinkPageButtonAppearance,
	type LinkPageSectionAppearance,
} from "@starter/infinite-links";
import { Switch } from "@starter/ui/components/switch";

import {
	buttonRadius,
	buttonStyleCss,
	SampleButton,
	shadowCss,
	shadowOption,
	shadowOptions,
	shadowPatch,
	useDesignTheme,
} from "./links-design-preview";
import { LinksLinkDesignPicker } from "./links-link-design-picker";
import { LinksColorList, LinksColorRow, LinksSegmented, LinksTilePicker } from "./links-option-controls";
import { LinksFieldset } from "./links-panel";
import type { LinksPageController } from "./use-links-page-controller";

const supportsButtons = (block: LinkPageBlock) =>
	block.kind === "collection" || block.kind === "link" || (block.kind === "text" && block.button !== null);

const surfacePreviews = ({ background, foreground }: { background: string; foreground: string }) =>
	({
		band: { backgroundColor: background, borderRadius: 0 },
		card: {
			backgroundColor: background,
			borderRadius: "0.75rem",
			margin: "0.75rem",
			width: "calc(100% - 1.5rem)",
		},
		plain: {
			border: `1px dashed ${foreground}40`,
			borderRadius: "0.75rem",
			margin: "0.75rem",
			width: "calc(100% - 1.5rem)",
		},
	}) satisfies Record<LinkPageSectionAppearance["style"], CSSProperties>;

const ButtonPreview = ({
	buttons,
	controller,
	foreground,
}: {
	buttons: LinkPageButtonAppearance;
	controller: LinksPageController;
	foreground: string | null;
}) => {
	const theme = useDesignTheme(controller);
	const buttonColor = buttons.colors.button ?? theme.colors.action;

	const textFallbacks = {
		glass: foreground ?? theme.colors.foreground,
		outline: buttonColor,
		soft: theme.colors.onAction,
		solid: theme.colors.onAction,
	} satisfies Record<LinkPageButtonAppearance["style"], string>;

	return (
		<SampleButton
			className='min-h-9 min-w-0 w-[72%] px-3 text-xs'
			label='Aa'
			style={{
				borderRadius: `${28 * buttonRadius({ buttons, controller })}px`,
				boxShadow: shadowCss({
					shadow: buttons.shadow,
					shadowColor: buttons.colors.shadow ?? theme.colors.foreground,
				}),
				color: buttons.colors.text ?? textFallbacks[buttons.style],
				...buttonStyleCss({
					background: theme.colors.canvas,
					button: buttonColor,
					foreground: foreground ?? theme.colors.foreground,
					opacity: buttons.opacity,
					style: buttons.style,
				}),
			}}
		/>
	);
};

export const LinksSectionDesign = ({
	block,
	controller,
}: {
	block: LinkPageBlock;
	controller: LinksPageController;
}) => {
	const t = useTranslations("links.editor");
	const design = useTranslations("links.design");
	const theme = useDesignTheme(controller);
	const { appearance } = block;
	const previews = surfacePreviews({ background: theme.colors.featured, foreground: theme.colors.foreground });

	const updateAppearance = (update: Partial<LinkPageSectionAppearance>) =>
		controller.updateBlockAppearance({
			id: block.id,
			update: (current) => ({ ...current, ...update }),
		});

	const localDesign = block.kind === "link" || block.kind === "collection" ? block.design : undefined;

	const buttons = localDesign
		? { ...(appearance.buttons ?? controller.document.appearance.buttons), design: localDesign }
		: appearance.buttons;

	const setButtons = (next: LinkPageButtonAppearance | null) => {
		if (block.kind === "link" || block.kind === "collection") {
			controller.updateBlock({
				id: block.id,
				kind: block.kind,
				update: (current) => ({
					...current,
					appearance: { ...current.appearance, buttons: next },
					design: undefined,
				}),
			});
		} else {
			updateAppearance({ buttons: next });
		}
	};

	const updateButtons = (update: Partial<Omit<LinkPageButtonAppearance, "colors">>) => {
		if (buttons) {
			setButtons({ ...buttons, ...update });
		}
	};

	const updateButtonColors = (colors: Partial<LinkPageButtonAppearance["colors"]>) => {
		if (buttons) {
			setButtons({ ...buttons, colors: { ...buttons.colors, ...colors } });
		}
	};

	const placement = controller.document.headerBlockIds.includes(block.id) ? "header" : "page";

	return (
		<>
			{supportsButtons(block) && (
				<LinksFieldset legend={t("buttonOverride")}>
					<div className='flex items-center justify-between gap-4'>
						<p className='text-sm text-muted-foreground'>{t("buttonOverrideDescription")}</p>
						<Switch
							aria-label={t("buttonOverride")}
							checked={buttons !== null}
							onCheckedChange={(checked) =>
								setButtons(checked ? { ...controller.document.appearance.buttons } : null)
							}
						/>
					</div>
					{buttons && (
						<>
							{(block.kind === "link" || block.kind === "collection") && (
								<LinksLinkDesignPicker
									block={block}
									controller={controller}
									onChange={(design) => setButtons({ ...buttons, design })}
									value={localDesign ?? buttons.design}
								/>
							)}
							<LinksTilePicker
								label={design("buttonStyle")}
								onChange={(style) => updateButtons({ style })}
								options={linkPageButtonStyles.map((style) => ({
									label: design(`buttonStyles.${style}`),
									preview: (
										<span className='flex size-full items-center justify-center'>
											<ButtonPreview
												buttons={{ ...buttons, style }}
												controller={controller}
												foreground={appearance.foregroundColor}
											/>
										</span>
									),
									value: style,
								}))}
								previewClassName='overflow-hidden'
								value={buttons.style === "soft" ? "solid" : buttons.style}
							/>
							<LinksSegmented
								label={design("shadow")}
								onChange={(option) =>
									updateButtons(
										shadowPatch({
											option,
											strength: buttons.shadowStrength ?? (buttons.shadow === "none" ? 0 : 1),
										})
									)
								}
								options={shadowOptions.map((value) => ({ label: design(`shadows.${value}`), value }))}
								value={shadowOption(buttons.shadow)}
							/>
							<LinksColorList>
								<LinksColorRow
									fallback={theme.colors.action}
									label={design("buttonColor")}
									onChange={(button) => updateButtonColors({ button })}
									value={buttons.colors.button}
								/>
								<LinksColorRow
									fallback={theme.colors.onAction}
									label={design("buttonTextColor")}
									onChange={(text) => updateButtonColors({ text })}
									value={buttons.colors.text}
								/>
								{buttons.shadow === "hard" && (
									<LinksColorRow
										fallback={theme.colors.foreground}
										label={design("shadowColor")}
										onChange={(shadow) => updateButtonColors({ shadow })}
										value={buttons.colors.shadow}
									/>
								)}
							</LinksColorList>
						</>
					)}
				</LinksFieldset>
			)}
			<LinksFieldset description={t("sectionPlacementDescription")} legend={t("sectionPlacement")}>
				<LinksSegmented
					label={t("sectionPlacement")}
					onChange={(nextPlacement) =>
						controller.setSectionHeaderLinked({ id: block.id, linked: nextPlacement === "header" })
					}
					options={(["page", "header"] as const).map((value) => ({
						label: t(`sectionPlacements.${value}`),
						value,
					}))}
					value={placement}
				/>
			</LinksFieldset>
			<LinksFieldset legend={t("sectionDesign")}>
				<LinksTilePicker
					columns={3}
					label={t("sectionStyle")}
					onChange={(style) => updateAppearance({ style })}
					options={linkPageSectionStyles.map((style) => ({
						label: t(`sectionStyles.${style}`),
						preview: <span className='h-full min-h-20' style={previews[style]} />,
						value: style,
					}))}
					previewClassName='min-h-20'
					value={appearance.style}
				/>
			</LinksFieldset>
			<LinksFieldset legend={t("sectionColors")}>
				<LinksColorList>
					{appearance.style !== "plain" && (
						<LinksColorRow
							fallback={theme.colors.featured}
							label={t("sectionBackground")}
							onChange={(backgroundColor) => updateAppearance({ backgroundColor })}
							value={appearance.backgroundColor}
						/>
					)}
					<LinksColorRow
						fallback={theme.colors.foreground}
						label={t("sectionText")}
						onChange={(foregroundColor) => updateAppearance({ foregroundColor })}
						value={appearance.foregroundColor}
					/>
				</LinksColorList>
			</LinksFieldset>
		</>
	);
};
