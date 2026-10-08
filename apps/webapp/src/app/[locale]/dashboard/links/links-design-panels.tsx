"use client";

import { useState, type ReactNode } from "react";

import { TextItalicIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { EditorFontPairingOption } from "@/app/[locale]/dashboard/components/editor/editor-font-pairing-option";
import {
	brandFontCatalog,
	brandFontPairings,
	featuredBrandFontPairingIds,
	getBrandFont,
	type BrandFontCatalogEntry,
	type BrandFontPairingId,
} from "@starter/infinite-brand";
import {
	linkPageDividerRules,
	linkPageThemes,
	linkPageWallpaperStyle,
	type LinkPageAppearance,
	type LinkPageFont,
} from "@starter/infinite-links";
import { RadioGroup } from "@starter/ui/components/radio-group";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@starter/ui/components/select";
import { Toggle } from "@starter/ui/components/toggle";

import { LinksBackgroundPanel } from "./links-design-background-panel";
import { LinksButtonsPanel } from "./links-design-buttons-panel";
import { LinksHeaderPanel } from "./links-design-header-panel";
import { useBrandOverride, useDesignTheme } from "./links-design-preview";
import {
	LinksColorList,
	LinksColorRow,
	LinksFieldGroup,
	LinksRatioSlider,
	LinksSegmented,
	LinksSelect,
} from "./links-option-controls";
import { LinksDraftFooter, LinksFieldset, LinksPanel } from "./links-panel";
import { LinksThemePreview, ThemeTile } from "./links-theme-preview";
import type { LinksDesignSection } from "./use-links-editor-view";
import type { LinksPageController } from "./use-links-page-controller";

const brandThemeValue = "brand";

const ThemePanel = ({ controller }: { controller: LinksPageController }) => {
	const t = useTranslations("links.design");
	const { appearance } = controller.document;
	const selected = linkPageThemes.find((theme) => theme.id === appearance.themeId);

	return (
		<RadioGroup
			aria-label={t("theme")}
			className='grid grid-cols-2 @min-[24rem]:grid-cols-3'
			onValueChange={(id) => {
				if (id === brandThemeValue) {
					controller.resetToBrand();

					return;
				}

				const theme = linkPageThemes.find((candidate) => candidate.id === id);

				if (theme) {
					controller.applyTheme({ theme });
				}
			}}
			value={appearance.brandOverride === null ? brandThemeValue : (selected?.id ?? "")}
		>
			<ThemeTile name={t("brandTheme")} value={brandThemeValue}>
				<LinksThemePreview controller={controller} />
			</ThemeTile>
			{linkPageThemes.map((theme) => (
				<ThemeTile
					key={theme.id}
					name={t(`themeNames.${theme.id}`)}
					style={{
						...linkPageWallpaperStyle({
							background: theme.colors.background,
							foreground: theme.colors.neutral,
							wallpaper: theme.wallpaper,
						}),
						color: theme.colors.neutral,
					}}
					value={theme.id}
				>
					<LinksThemePreview controller={controller} theme={theme} />
				</ThemeTile>
			))}
		</RadioGroup>
	);
};

const fontOptions = Object.entries(brandFontCatalog)
	.map(([fontId, font]: [string, BrandFontCatalogEntry]) => ({
		font,
		fontId,
		label: font.family.replace(/ Variable$/u, ""),
	}))
	.toSorted((left, right) => left.label.localeCompare(right.label));

const weightsFor = (font: BrandFontCatalogEntry) =>
	font.staticWeights ??
	[100, 200, 300, 400, 500, 600, 700, 800, 900].filter(
		(weight) => weight >= font.weight.min && weight <= font.weight.max
	);

const fontFamily = (font: BrandFontCatalogEntry) => `${font.family}, ${font.fallback}`;

const FontField = ({
	fallback,
	label,
	onChange,
	value,
}: {
	fallback: LinkPageFont;
	label: string;
	onChange: (font: LinkPageFont) => void;
	value: LinkPageFont | undefined;
}) => {
	const t = useTranslations("links.design");
	const current = value ?? fallback;
	const entry = getBrandFont({ fontId: current.fontId });
	const weights = entry ? weightsFor(entry) : [current.weight];

	return (
		<LinksFieldGroup label={label}>
			<div className='flex gap-2'>
				<Select
					onValueChange={(fontId) => {
						const next = fontOptions.find((option) => option.fontId === fontId);

						if (!next) {
							return;
						}

						const weight = weightsFor(next.font).reduce((best, candidate) =>
							Math.abs(candidate - current.weight) < Math.abs(best - current.weight) ? candidate : best
						);

						onChange({ ...current, fontId: next.fontId, weight });
					}}
					value={current.fontId}
				>
					<SelectTrigger aria-label={label} className='min-w-0 flex-1' size='lg'>
						<SelectValue>
							{() => (
								<span
									className='truncate'
									style={{ fontFamily: entry ? fontFamily(entry) : undefined }}
								>
									{fontOptions.find((option) => option.fontId === current.fontId)?.label}
								</span>
							)}
						</SelectValue>
					</SelectTrigger>
					<SelectPopup>
						{fontOptions.map((option) => (
							<SelectItem key={option.fontId} value={option.fontId}>
								<span style={{ fontFamily: fontFamily(option.font) }}>{option.label}</span>
							</SelectItem>
						))}
					</SelectPopup>
				</Select>
				<Select
					onValueChange={(weight) => onChange({ ...current, weight: Number(weight) })}
					value={String(current.weight)}
				>
					<SelectTrigger aria-label={t("fontWeight")} className='w-20 min-w-0 shrink-0' size='lg'>
						<SelectValue />
					</SelectTrigger>
					<SelectPopup>
						{weights.map((weight) => (
							<SelectItem key={weight} value={String(weight)}>
								{weight}
							</SelectItem>
						))}
					</SelectPopup>
				</Select>
				<Toggle
					aria-label={t("fontItalic")}
					onPressedChange={(italic) => onChange({ ...current, italic })}
					pressed={current.italic === true}
					size='lg'
					title={t("fontItalic")}
					variant='outline'
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={TextItalicIcon} strokeWidth={1.75} />
				</Toggle>
			</div>
		</LinksFieldGroup>
	);
};

const defaultDivider = { rule: "none", ruleWidth: 0.2, size: 0.2, spaceAbove: 0.375, spaceBelow: 0.375 } as const;

const DividerFields = ({ controller }: { controller: LinksPageController }) => {
	const t = useTranslations("links.design");
	const divider = controller.document.appearance.divider ?? defaultDivider;

	const update = (patch: Partial<NonNullable<LinkPageAppearance["divider"]>>) =>
		controller.updateAppearance({ divider: { ...divider, ...patch } });

	return (
		<LinksFieldset legend={t("dividers")}>
			<LinksRatioSlider label={t("dividerSize")} onChange={(size) => update({ size })} value={divider.size} />
			<LinksRatioSlider
				label={t("dividerSpaceAbove")}
				onChange={(spaceAbove) => update({ spaceAbove })}
				value={divider.spaceAbove}
			/>
			<LinksRatioSlider
				label={t("dividerSpaceBelow")}
				onChange={(spaceBelow) => update({ spaceBelow })}
				value={divider.spaceBelow}
			/>
			<LinksSelect
				label={t("dividerRule")}
				onChange={(rule) => update({ rule })}
				options={linkPageDividerRules.map((rule) => ({ label: t(`dividerRules.${rule}`), value: rule }))}
				value={divider.rule}
			/>
			{divider.rule !== "none" && (
				<LinksRatioSlider
					label={t("dividerRuleWidth")}
					onChange={(ruleWidth) => update({ ruleWidth })}
					value={divider.ruleWidth}
				/>
			)}
		</LinksFieldset>
	);
};

const fontPairingIds: ReadonlyArray<BrandFontPairingId> = [
	...new Set<BrandFontPairingId>([
		...featuredBrandFontPairingIds,
		"editorial",
		"outfit",
		"figtree",
		"playfair-source",
	]),
];

const fontModes = ["pairings", "custom"] as const;

type FontMode = (typeof fontModes)[number];

const TextPanel = ({ controller }: { controller: LinksPageController }) => {
	const t = useTranslations("links.design");
	const updateOverride = useBrandOverride(controller);
	const { colors } = useDesignTheme(controller);
	const { typography } = controller.document.appearance;
	const [mode, setMode] = useState<FontMode>(typography ? "custom" : "pairings");
	const { body, heading } = controller.brand.typography;

	const fallback = {
		body: { fontId: body.default.fontId, weight: body.default.weight },
		heading: { fontId: heading.default.fontId, weight: heading.default.weight },
	};

	const updateFonts = (patch: Partial<typeof fallback>) =>
		controller.updateAppearance({ typography: { ...fallback, ...typography, ...patch } });

	const selected = typography
		? ""
		: (controller.document.appearance.brandOverride?.fontPairingId ??
			fontPairingIds.find(
				(id) =>
					brandFontPairings[id].heading.default.fontId === heading.default.fontId &&
					brandFontPairings[id].body.default.fontId === body.default.fontId
			) ??
			"");

	return (
		<>
			<LinksSegmented
				hideLabel
				label={t("fonts")}
				onChange={setMode}
				options={fontModes.map((value) => ({ label: t(`fontModes.${value}`), value }))}
				value={mode}
			/>
			{mode === "pairings" ? (
				<RadioGroup
					aria-label={t("fonts")}
					className='grid grid-cols-2'
					onValueChange={(pairingId) => {
						const fontPairingId = fontPairingIds.find((candidate) => candidate === pairingId);

						if (fontPairingId) {
							updateOverride({ fontPairingId });
							controller.updateAppearance({ typography: null });
						}
					}}
					value={selected}
				>
					{fontPairingIds.map((pairingId) => (
						<EditorFontPairingOption key={pairingId} pairingId={pairingId} />
					))}
				</RadioGroup>
			) : (
				<LinksFieldset>
					<FontField
						fallback={fallback.heading}
						label={t("headingFont")}
						onChange={(font) => updateFonts({ heading: font })}
						value={typography?.heading}
					/>
					<FontField
						fallback={fallback.body}
						label={t("bodyFont")}
						onChange={(font) => updateFonts({ body: font })}
						value={typography?.body}
					/>
				</LinksFieldset>
			)}
			<LinksFieldset legend={t("colors")}>
				<LinksColorList>
					<LinksColorRow
						label={t("pageText")}
						onChange={(neutral) => neutral && updateOverride({ colors: { neutral } })}
						value={colors.foreground}
					/>
				</LinksColorList>
			</LinksFieldset>
			<DividerFields controller={controller} />
		</>
	);
};

const panels = {
	background: LinksBackgroundPanel,
	buttons: LinksButtonsPanel,
	header: LinksHeaderPanel,
	text: TextPanel,
	theme: ThemePanel,
} satisfies Record<LinksDesignSection, (props: { controller: LinksPageController }) => ReactNode>;

export const LinksDesignPanel = ({
	controller,
	section,
}: {
	controller: LinksPageController;
	section: LinksDesignSection;
}) => {
	const t = useTranslations("links.design");
	const Panel = panels[section];

	return (
		<LinksPanel
			footer={
				<LinksDraftFooter
					dirty={controller.viewDirty}
					onCancel={controller.cancelView}
					onDone={() => controller.setView({ kind: "root" })}
				/>
			}
			onBack={controller.cancelView}
			title={t(section)}
		>
			<Panel controller={controller} />
		</LinksPanel>
	);
};
