"use client";

import { useState } from "react";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { EditorFontPairingOption } from "@/app/[locale]/dashboard/components/editor/editor-font-pairing-option";
import { EditorPanelFooter } from "@/app/[locale]/dashboard/components/editor/editor-panel-footer";
import { EditorPanelHeader } from "@/app/[locale]/dashboard/components/editor/editor-panel-header";
import { EditorSuggestionField } from "@/app/[locale]/dashboard/components/editor/editor-suggestion-field";
import { BrandPalettePicker } from "@/components/brand-palette-picker";
import { BusinessLogoField } from "@/components/business-logo-field";
import { apiClient } from "@/lib/api-client";
import {
	applyBrandUpdate,
	brandButtonStyles,
	brandColorNames,
	brandCornerStyles,
	brandFontPairings,
	brandFoundationSchema,
	featuredBrandFontPairingIds,
	findBrandFontPairing,
	findBrandPalettePreset,
	type BrandFoundationV1,
} from "@starter/infinite-brand";
import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";
import { Fieldset, FieldsetLegend } from "@starter/ui/components/fieldset";
import { Input } from "@starter/ui/components/input";
import { Radio, RadioGroup } from "@starter/ui/components/radio-group";
import { toast } from "@starter/ui/components/toaster";
import { cn } from "@starter/ui/lib/utils";

import type { WebsiteEditor } from "../use-website-editor";
import {
	areWebsiteBrandCustomizationsEqual,
	findWebsiteBrandRecommendation,
	websiteBrandPalettePresets,
} from "./website-brand-options";

export type WebsiteBrandCustomizeSection = "corners" | "fonts" | "logo" | "palette";

type WebsiteBrandRecommendation = ReturnType<typeof findWebsiteBrandRecommendation>;

const RecommendedBadge = () => {
	const t = useTranslations("website.customize");

	return (
		<Badge className='absolute top-2 start-2 z-10' variant='dark'>
			{t("suggest.recommended")}
		</Badge>
	);
};

const cornerPreviewClassName = {
	rounded: "rounded-xl",
	soft: "rounded-full",
	square: "rounded-none",
	subtle: "rounded-md",
} as const;

const optionCardClassName =
	"relative flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl bg-background p-4 outline outline-border transition-[outline-color,opacity] focus-within:outline-2 focus-within:outline-ring has-data-checked:outline-2 has-data-checked:outline-foreground has-data-unchecked:[@media(hover:hover)]:hover:opacity-80 motion-reduce:transition-none";

const buttonPreviewClassName = {
	outline: "text-foreground ring-[1.5px] ring-foreground ring-inset",
	solid: "bg-primary text-primary-foreground",
} as const;

const WebsitePaletteControls = ({
	brand,
	onChange,
	recommended,
}: {
	brand: BrandFoundationV1;
	onChange: (brand: BrandFoundationV1) => void;
	recommended: string | null;
}) => {
	const t = useTranslations("website.customize");
	const selectedPreset = findBrandPalettePreset({ colors: brand.colors })?.id ?? "";

	return (
		<div className='space-y-7'>
			<Fieldset size='compact'>
				<FieldsetLegend className='sr-only'>{t("palette.title")}</FieldsetLegend>
				<div className='divide-y overflow-hidden rounded-xl border bg-background'>
					{brandColorNames.map((colorName) => (
						<label
							className='relative flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 focus-within:bg-muted/56 [@media(hover:hover)]:hover:bg-muted/56'
							key={colorName}
						>
							<span
								className='size-7 shrink-0 rounded-md outline outline-1 -outline-offset-1 outline-foreground/12'
								style={{ backgroundColor: brand.colors[colorName] }}
							/>
							<span className='min-w-0 flex-1 text-sm font-medium'>
								{t(`palette.colors.${colorName}`)}
							</span>
							<span className='font-mono text-xs text-muted-foreground uppercase'>
								{brand.colors[colorName]}
							</span>
							<Input
								aria-label={t(`palette.colors.${colorName}`)}
								onChange={(event) =>
									onChange(
										brandFoundationSchema.parse({
											...brand,
											colors: { ...brand.colors, [colorName]: event.currentTarget.value },
										})
									)
								}
								type='color'
								value={brand.colors[colorName]}
								variant='overlay'
							/>
						</label>
					))}
				</div>
			</Fieldset>
			<Fieldset size='compact'>
				<FieldsetLegend>{t("palette.presets")}</FieldsetLegend>
				<BrandPalettePicker
					label={t("palette.presets")}
					onValueChange={(presetId) => {
						const preset = websiteBrandPalettePresets.find(({ id }) => id === presetId);

						if (preset) {
							onChange(brandFoundationSchema.parse({ ...brand, colors: preset.colors }));
						}
					}}
					optionLabel={(index) => t("palette.preset", { number: index + 1 })}
					presets={websiteBrandPalettePresets}
					recommended={recommended ? { id: recommended, label: t("suggest.recommended") } : null}
					swatches={brandColorNames.slice(1)}
					value={selectedPreset}
				/>
			</Fieldset>
		</div>
	);
};

const WebsiteFontControls = ({
	brand,
	onChange,
	recommended,
}: {
	brand: BrandFoundationV1;
	onChange: (brand: BrandFoundationV1) => void;
	recommended: string | null;
}) => {
	const t = useTranslations("website.customize");

	const selectedPairing =
		findBrandFontPairing({ pairingIds: featuredBrandFontPairingIds, typography: brand.typography }) ?? "";

	return (
		<Fieldset size='compact'>
			<FieldsetLegend className='sr-only'>{t("fonts.title")}</FieldsetLegend>
			<RadioGroup
				aria-label={t("fonts.title")}
				className='grid grid-cols-2'
				onValueChange={(pairingId) => {
					const selected = featuredBrandFontPairingIds.find((candidate) => candidate === pairingId);

					if (selected) {
						onChange(
							brandFoundationSchema.parse({
								...brand,
								typography: { catalogVersion: 1, ...brandFontPairings[selected] },
							})
						);
					}
				}}
				value={selectedPairing}
			>
				{featuredBrandFontPairingIds.map((pairingId) => (
					<EditorFontPairingOption key={pairingId} pairingId={pairingId}>
						{pairingId === recommended ? <RecommendedBadge /> : null}
					</EditorFontPairingOption>
				))}
			</RadioGroup>
		</Fieldset>
	);
};

const WebsiteCornerControls = ({
	brand,
	onChange,
	recommended,
}: {
	brand: BrandFoundationV1;
	onChange: (brand: BrandFoundationV1) => void;
	recommended: string | null;
}) => {
	const t = useTranslations("website.customize");

	return (
		<div className='space-y-7'>
			<Fieldset size='compact'>
				<FieldsetLegend className='sr-only'>{t("corners.title")}</FieldsetLegend>
				<RadioGroup
					aria-label={t("corners.title")}
					className='grid grid-cols-2'
					onValueChange={(cornerStyle) => {
						const selected = brandCornerStyles.find((candidate) => candidate === cornerStyle);

						if (selected) {
							onChange(brandFoundationSchema.parse({ ...brand, corners: { style: selected } }));
						}
					}}
					value={brand.corners.style}
				>
					{brandCornerStyles.map((cornerStyle) => (
						<label className={optionCardClassName} key={cornerStyle}>
							<Radio value={cornerStyle} variant='card' />
							{cornerStyle === recommended ? <RecommendedBadge /> : null}
							<span
								className={cn(
									"inline-flex min-h-11 items-center bg-primary px-5 text-sm font-medium text-primary-foreground",
									cornerPreviewClassName[cornerStyle]
								)}
							>
								{t("corners.preview")}
							</span>
							<span className='mt-3 text-xs font-medium'>{t(`corners.options.${cornerStyle}`)}</span>
						</label>
					))}
				</RadioGroup>
			</Fieldset>
			<Fieldset size='compact'>
				<FieldsetLegend>{t("buttons.title")}</FieldsetLegend>
				<RadioGroup
					aria-label={t("buttons.title")}
					className='grid grid-cols-2'
					onValueChange={(style) => {
						const selected = brandButtonStyles.find((candidate) => candidate === style);

						if (selected) {
							onChange(brandFoundationSchema.parse({ ...brand, buttons: { style: selected } }));
						}
					}}
					value={brand.buttons?.style ?? "solid"}
				>
					{brandButtonStyles.map((style) => (
						<label className={optionCardClassName} key={style}>
							<Radio value={style} variant='card' />
							<span
								className={cn(
									"inline-flex min-h-11 items-center px-5 text-sm font-medium",
									cornerPreviewClassName[brand.corners.style],
									buttonPreviewClassName[style]
								)}
							>
								{t("corners.preview")}
							</span>
							<span className='mt-3 text-xs font-medium'>{t(`buttons.options.${style}`)}</span>
						</label>
					))}
				</RadioGroup>
			</Fieldset>
		</div>
	);
};

const customizationControls = {
	corners: WebsiteCornerControls,
	fonts: WebsiteFontControls,
	palette: WebsitePaletteControls,
};

const WebsiteBrandControls = ({
	brand,
	onChange,
	onSuggest,
	recommended,
	section,
	suggesting,
}: {
	brand: BrandFoundationV1;
	onChange: (brand: BrandFoundationV1) => void;
	onSuggest: (request: string) => void;
	recommended: string | null;
	section: keyof typeof customizationControls;
	suggesting: boolean;
}) => {
	const Controls = customizationControls[section];

	return (
		<>
			<EditorSuggestionField namespace='website.customize' onSubmit={onSuggest} pending={suggesting} />
			<Controls brand={brand} onChange={onChange} recommended={recommended} />
		</>
	);
};

export const WebsiteBrandCustomizePanel = ({
	editor,
	section,
}: {
	editor: WebsiteEditor;
	section: WebsiteBrandCustomizeSection;
}) => {
	const t = useTranslations("website.customize");
	const draft = editor.draft;
	const [recommendation, setRecommendation] = useState<WebsiteBrandRecommendation | null>(null);

	const recommend = useMutation(
		apiClient.brands.recommend.mutationOptions({
			onError: () => toast.error(t("suggest.failed")),
			onSuccess: (result) => {
				if (!result.update || !draft) {
					toast.info(t("suggest.none"));

					return;
				}

				setRecommendation(findWebsiteBrandRecommendation(result));
				onChange(applyBrandUpdate({ brand: draft.snapshot.brand, update: result.update }));
			},
		})
	);

	if (editor.overlay !== "customize" || !draft) {
		return null;
	}

	const brand = draft.snapshot.brand;
	const unchanged = areWebsiteBrandCustomizationsEqual({ left: brand, right: draft.baselineSnapshot.brand });

	const title = {
		corners: t("corners.title"),
		fonts: t("fonts.title"),
		logo: t("logo.title"),
		palette: t("palette.title"),
	}[section];

	const content = draft.snapshot.document.content;

	const onChange = (nextBrand: BrandFoundationV1) =>
		editor.previewDraft({ input: { brand: nextBrand, operation: "update-brand" }, selection: null });

	return (
		<div className='flex h-full min-h-0 flex-col'>
			<EditorPanelHeader backLabel={t("back")} onBack={editor.cancelDraft} title={title} />
			<div className='@container/customize min-h-0 flex-1 space-y-6 overflow-y-auto p-4'>
				{section === "logo" ? (
					<BusinessLogoField
						disabled={editor.pending !== null}
						logo={brand.logo}
						name={
							content[editor.locale]?.site.name ??
							content[draft.snapshot.document.defaultLocale]?.site.name ??
							""
						}
						onChange={(logo) => onChange(brandFoundationSchema.parse({ ...brand, logo }))}
					/>
				) : (
					<WebsiteBrandControls
						brand={brand}
						onChange={onChange}
						onSuggest={(request) => recommend.mutate({ request })}
						recommended={recommendation?.[section] ?? null}
						section={section}
						suggesting={recommend.isPending}
					/>
				)}
			</div>
			<EditorPanelFooter
				cancelDisabled={editor.pending !== null}
				cancelLabel={t("cancel")}
				onCancel={editor.cancelDraft}
			>
				<Button
					disabled={unchanged}
					loading={editor.pending?.operation === "update-brand"}
					onClick={editor.commitDraft}
					type='button'
				>
					{t("done")}
				</Button>
			</EditorPanelFooter>
		</div>
	);
};
