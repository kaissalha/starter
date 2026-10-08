"use client";

import { useTranslations } from "next-intl";

import { BusinessLogoField } from "@/components/business-logo-field";
import { MediaPicker } from "@/components/media/media-picker";
import {
	isLinkPageStudioLayout,
	linkPageSectionStyles,
	linkPageTitleSizes,
	type LinkPageBanner,
	type LinkPageProfile,
} from "@starter/infinite-links";

import { LinksWallpaperSection, type LinksWallpaperEditor } from "./links-design-background-panel";
import { useDesignTheme } from "./links-design-preview";
import {
	LinksColorList,
	LinksColorRow,
	LinksFieldGroup,
	LinksRatioSlider,
	LinksSegmented,
	LinksToggle,
} from "./links-option-controls";
import { LinksFieldset } from "./links-panel";
import { LinksProfileDesignPicker } from "./links-profile-design-picker";
import type { LinksPageController } from "./use-links-page-controller";

const bannerLayouts: ReadonlyArray<LinkPageProfile["layout"]> = [
	"hero",
	"minimal-01",
	"minimal-02",
	"minimal-03",
	"minimal-04",
	"banner",
	"business",
];

const fadeLayouts: ReadonlyArray<LinkPageProfile["layout"]> = ["banner", "business", "headshot"];

const useHeaderEditor = (controller: LinksPageController) => {
	const theme = useDesignTheme(controller);
	const { appearance, profile } = controller.document;
	const image = appearance.profileImage ?? { border: 0, borderColor: theme.colors.canvas, shadow: 0, size: 0.5 };

	const banner: LinkPageBanner = appearance.banner ?? {
		color: theme.colors.featured,
		gradientDirection: "down",
		pattern: "polka",
		style: "fill",
	};

	const bannerEditor: LinksWallpaperEditor = {
		update: (patch) => controller.updateAppearance({ banner: { ...banner, ...patch } }),
		wallpaper: banner,
	};

	return {
		appearance,
		banner,
		bannerEditor,
		hasBanner: bannerLayouts.includes(profile.layout),
		image,
		profile,
		studio: isLinkPageStudioLayout(profile.layout),
		theme,
		updateImage: (patch: Partial<typeof image>) =>
			controller.updateAppearance({ profileImage: { ...image, ...patch } }),
	};
};

const FadeToggle = ({ controller }: { controller: LinksPageController }) => {
	const t = useTranslations("links.design");
	const { banner, profile } = useHeaderEditor(controller);

	if (!fadeLayouts.includes(profile.layout)) {
		return null;
	}

	return (
		<LinksToggle
			checked={banner.fade === true}
			label={t("bannerFade")}
			onChange={(fade) => controller.updateAppearance({ banner: { ...banner, fade } })}
		/>
	);
};

const ProfileFields = ({ controller }: { controller: LinksPageController }) => {
	const t = useTranslations("links.design");
	const { appearance, hasBanner, image, profile, studio, theme, updateImage } = useHeaderEditor(controller);

	return (
		<LinksFieldset legend={t("profile")}>
			<LinksFieldGroup label={t("logo")}>
				<BusinessLogoField
					disabled={controller.changingLogo}
					logo={controller.brand.logo}
					name={profile.title[controller.locale] ?? ""}
					onChange={controller.changeLogo}
				/>
			</LinksFieldGroup>
			<MediaPicker
				kind='image'
				label={t("imageUrl")}
				onRemove={() => controller.updateProfile({ imageUrl: null })}
				onSelect={(media) => controller.updateProfile({ imageUrl: media.url })}
				previewUrl={profile.imageUrl}
			/>
			{studio ? (
				<>
					<LinksRatioSlider
						label={t("avatarSize")}
						onChange={(size) => updateImage({ size })}
						value={image.size}
					/>
					{profile.layout !== "headshot" && (
						<>
							<LinksRatioSlider
								label={t("avatarRing")}
								onChange={(border) => updateImage({ border })}
								value={image.border}
							/>
							<LinksRatioSlider
								label={t("avatarShadow")}
								onChange={(shadow) => updateImage({ shadow })}
								value={image.shadow}
							/>
						</>
					)}
				</>
			) : (
				<>
					<LinksSegmented
						label={t("headerDesign")}
						onChange={(style) => controller.updateHeaderAppearance({ style })}
						options={linkPageSectionStyles.map((style) => ({
							label: t(`headerStyles.${style}`),
							value: style,
						}))}
						value={appearance.header.style}
					/>
					<LinksSegmented
						label={t("titleSize")}
						onChange={(titleSize) => controller.updateProfile({ titleSize })}
						options={linkPageTitleSizes.map((size) => ({ label: t(`titleSizes.${size}`), value: size }))}
						value={profile.titleSize}
					/>
				</>
			)}
			{!hasBanner && <FadeToggle controller={controller} />}
			<LinksColorList>
				<LinksColorRow
					fallback={theme.colors.foreground}
					label={t("titleColor")}
					onChange={(titleColor) => controller.updateAppearance({ titleColor })}
					value={appearance.titleColor}
				/>
				{!studio && (
					<LinksColorRow
						fallback={theme.colors.foreground}
						label={t("headerTextColor")}
						onChange={(foregroundColor) => controller.updateHeaderAppearance({ foregroundColor })}
						value={appearance.header.foregroundColor}
					/>
				)}
				{!studio && appearance.header.style !== "plain" && (
					<LinksColorRow
						fallback={theme.colors.featured}
						label={t("headerBackground")}
						onChange={(backgroundColor) => controller.updateHeaderAppearance({ backgroundColor })}
						value={appearance.header.backgroundColor}
					/>
				)}
				{studio && profile.layout !== "headshot" && image.border > 0 && (
					<LinksColorRow
						label={t("avatarRingColor")}
						onChange={(borderColor) => borderColor && updateImage({ borderColor })}
						value={image.borderColor}
					/>
				)}
			</LinksColorList>
		</LinksFieldset>
	);
};

export const LinksHeaderPanel = ({ controller }: { controller: LinksPageController }) => {
	const t = useTranslations("links.design");
	const { appearance, bannerEditor, hasBanner, studio } = useHeaderEditor(controller);

	return (
		<>
			<LinksProfileDesignPicker controller={controller} />
			<ProfileFields controller={controller} />
			{hasBanner && (
				<LinksWallpaperSection controller={controller} editor={bannerEditor} label={t("banner")} titled>
					<FadeToggle controller={controller} />
				</LinksWallpaperSection>
			)}
			<LinksFieldset legend={t("socialIcons")}>
				{studio && (
					<LinksRatioSlider
						label={t("socialIconSize")}
						onChange={(socialIconSize) => controller.updateAppearance({ socialIconSize })}
						value={appearance.socialIconSize ?? 0}
					/>
				)}
				<LinksToggle
					checked={appearance.socialsAtBottom === true}
					label={t("socialsAtBottom")}
					onChange={(socialsAtBottom) => controller.updateAppearance({ socialsAtBottom })}
				/>
			</LinksFieldset>
		</>
	);
};
