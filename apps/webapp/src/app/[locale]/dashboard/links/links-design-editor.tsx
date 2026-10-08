"use client";

import { useTranslations } from "next-intl";

import { getBrandFont } from "@starter/infinite-brand";
import { LinkPageRenderer, linkPageThemes } from "@starter/infinite-links";

import { EditorDesignList, EditorDesignRow } from "../components/editor/editor-design-list";
import { LinksDesignPanel } from "./links-design-panels";
import { buttonRadius, buttonStyleCss, SampleButton, shadowCss, useDesignTheme } from "./links-design-preview";
import type { LinksDesignSection } from "./use-links-editor-view";
import type { LinksPageController } from "./use-links-page-controller";

const PagePreview = ({ controller }: { controller: LinksPageController }) => (
	<span aria-hidden='true' className='pointer-events-none relative block size-full overflow-hidden' inert>
		<span className='absolute start-0 top-0 block h-[400%] w-[400%] origin-top-left scale-25 rtl:origin-top-right'>
			<LinkPageRenderer
				brand={controller.brand}
				document={controller.document}
				locale={controller.locale}
				preview
			/>
		</span>
	</span>
);

const DesignRoot = ({ controller }: { controller: LinksPageController }) => {
	const t = useTranslations("links.design");
	const { appearance } = controller.document;
	const brand = controller.brand;
	const theme = useDesignTheme(controller);
	const heading = getBrandFont({ fontId: brand.typography.heading.default.fontId });
	const body = getBrandFont({ fontId: brand.typography.body.default.fontId });
	const preset = linkPageThemes.find((candidate) => candidate.id === appearance.themeId);
	const selectedThemeName = preset ? t(`themeNames.${preset.id}`) : t("custom");
	const themeName = appearance.brandOverride === null ? t("brandTheme") : selectedThemeName;
	const open = (section: LinksDesignSection) => () => controller.setView({ kind: "design", section });

	const buttonText =
		appearance.buttons.colors.text ??
		(appearance.buttons.style === "solid" ? theme.colors.onAction : theme.colors.foreground);

	const buttonColor = appearance.buttons.colors.button ?? theme.colors.action;
	const fontName = (family?: string) => family?.replace(" Variable", "");

	const buttonCss = {
		borderRadius: `${28 * buttonRadius({ buttons: appearance.buttons, controller })}px`,
		boxShadow: shadowCss({
			shadow: appearance.buttons.shadow,
			shadowColor: appearance.buttons.colors.shadow ?? theme.colors.foreground,
		}),
		color: buttonText,
		...buttonStyleCss({
			background: theme.colors.canvas,
			button: buttonColor,
			foreground: theme.colors.foreground,
			opacity: appearance.buttons.opacity,
			style: appearance.buttons.style,
		}),
	};

	return (
		<EditorDesignList title={t("title")}>
			<EditorDesignRow
				onClick={open("theme")}
				preview={<PagePreview controller={controller} />}
				title={t("theme")}
				value={themeName}
			/>
			<EditorDesignRow
				onClick={open("background")}
				preview={<PagePreview controller={controller} />}
				title={t("background")}
				value={t(`wallpapers.${appearance.wallpaper.style}`)}
			/>
			<EditorDesignRow
				onClick={open("buttons")}
				preview={
					<span
						className='flex size-full items-center justify-center'
						style={{ backgroundColor: theme.colors.canvas }}
					>
						<SampleButton label={t("buttonPreview")} style={buttonCss} />
					</span>
				}
				title={t("buttons")}
				value={t(`buttonStyles.${appearance.buttons.style}`)}
			/>
			<EditorDesignRow
				onClick={open("text")}
				preview={
					<span className='grid max-w-full gap-1 px-4 text-center'>
						<span className='truncate text-2xl font-semibold' style={{ fontFamily: heading?.family }}>
							{fontName(heading?.family)}
						</span>
						<span className='truncate text-sm text-muted-foreground' style={{ fontFamily: body?.family }}>
							{fontName(body?.family)}
						</span>
					</span>
				}
				title={t("text")}
			/>
		</EditorDesignList>
	);
};

export const LinksDesignEditor = ({ controller }: { controller: LinksPageController }) => {
	const { view } = controller;

	if (view.kind === "design") {
		return <LinksDesignPanel controller={controller} section={view.section} />;
	}

	return <DesignRoot controller={controller} />;
};
