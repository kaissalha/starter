import type { ReactNode } from "react";

import { Text as PDFText, StyleSheet, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { usePdfxTheme, useSafeMemo } from "../../lib/theme-context";
import { resolvePdfColor } from "./utils/color";

type PdfxTheme = ReturnType<typeof usePdfxTheme>;

export type PageHeaderVariant =
	| "simple"
	| "centered"
	| "minimal"
	| "branded"
	| "logo-left"
	| "logo-right"
	| "two-column";

export type PageHeaderProps = {
	address?: string;
	background?: string;
	email?: string;
	fixed?: boolean;
	logo?: ReactNode;
	marginBottom?: number;
	noWrap?: boolean;
	phone?: string;
	rightSubText?: string;
	rightText?: string;
	style?: Style;
	subtitle?: string;
	title: string;
	titleColor?: string;
	variant?: PageHeaderVariant;
};

const createPageHeaderStyles = (t: PdfxTheme) => {
	const { borderRadius, fontWeights, spacing } = t.primitives;
	const c = t.colors;
	const { body, heading } = t.typography;

	return StyleSheet.create({
		brandedContainer: {
			alignItems: "center",
			backgroundColor: c.primary,
			borderRadius: borderRadius.sm,
			display: "flex",
			flexDirection: "column",
			padding: spacing[6],
		},
		centeredContainer: {
			alignItems: "center",
			borderBottomColor: c.border,
			borderBottomStyle: "solid",
			borderBottomWidth: spacing[0.5],
			display: "flex",
			flexDirection: "column",
			paddingBottom: spacing[4],
		},
		contactInfo: {
			color: c.mutedForeground,
			fontFamily: body.fontFamily,
			fontSize: t.primitives.typography.xs,
			marginTop: spacing[0.5],
			textAlign: "right",
		},
		logoContainer: { height: 48, marginRight: spacing[4], width: 48 },
		logoContent: { display: "flex", flex: 1, flexDirection: "column" },
		logoLeftContainer: {
			alignItems: "center",
			borderBottomColor: c.border,
			borderBottomStyle: "solid",
			borderBottomWidth: spacing[0.5],
			display: "flex",
			flexDirection: "row",
			paddingBottom: spacing[4],
		},
		logoRightContainer: {
			alignItems: "center",
			borderBottomColor: c.border,
			borderBottomStyle: "solid",
			borderBottomWidth: spacing[0.5],
			display: "flex",
			flexDirection: "row",
			justifyContent: "space-between",
			paddingBottom: spacing[4],
		},
		logoRightContent: { display: "flex", flex: 1, flexDirection: "column" },
		logoRightLogoContainer: { height: 48, marginLeft: spacing[4], width: 48 },
		minimalContainer: {
			alignItems: "center",
			borderBottomColor: c.primary,
			borderBottomStyle: "solid",
			borderBottomWidth: spacing[1],
			display: "flex",
			flexDirection: "row",
			justifyContent: "space-between",
			paddingBottom: spacing[3],
		},
		minimalLeft: { flex: 1 },
		minimalRight: { alignItems: "flex-end" },
		rightSubText: {
			color: c.mutedForeground,
			fontFamily: body.fontFamily,
			fontSize: t.primitives.typography.xs,
			marginTop: spacing[1],
			textAlign: "right",
		},
		rightText: {
			color: c.foreground,
			fontFamily: body.fontFamily,
			fontSize: body.fontSize,
			fontWeight: fontWeights.medium,
			textAlign: "right",
		},
		simpleContainer: {
			alignItems: "flex-start",
			borderBottomColor: c.border,
			borderBottomStyle: "solid",
			borderBottomWidth: spacing[0.5],
			display: "flex",
			flexDirection: "row",
			justifyContent: "space-between",
			paddingBottom: spacing[4],
		},
		simpleLeft: { display: "flex", flex: 1, flexDirection: "column" },
		simpleRight: { alignItems: "flex-end", display: "flex", flexDirection: "column" },
		subtitle: {
			color: c.mutedForeground,
			fontFamily: body.fontFamily,
			fontSize: body.fontSize,
			lineHeight: body.lineHeight,
			marginTop: spacing[1],
		},
		subtitleBranded: { color: c.primaryForeground, marginTop: spacing[1] },
		subtitleCentered: { textAlign: "center" },
		title: {
			color: c.foreground,
			fontFamily: heading.fontFamily,
			fontSize: heading.fontSize.h3,
			fontWeight: fontWeights.bold,
			lineHeight: heading.lineHeight,
			marginBottom: 0,
		},
		titleBranded: { color: c.primaryForeground },
		titleCentered: { textAlign: "center" },
		titleMinimal: { fontSize: heading.fontSize.h3, fontWeight: fontWeights.bold },
		twoColumnContainer: {
			alignItems: "flex-start",
			borderBottomColor: c.border,
			borderBottomStyle: "solid",
			borderBottomWidth: spacing[0.5],
			display: "flex",
			flexDirection: "row",
			justifyContent: "space-between",
			paddingBottom: spacing[4],
		},
		twoColumnLeft: { display: "flex", flex: 1, flexDirection: "column" },
		twoColumnRight: { alignItems: "flex-end", display: "flex", flexDirection: "column" },
	});
};

const PageHeaderLayoutVariants = ({
	address,
	containerOverrides,
	email,
	fixed,
	logo,
	marginBottom,
	noWrap,
	phone,
	rightSubText,
	rightText,
	styles,
	subtitle,
	title,
	titleOverrides,
	variant,
}: Pick<
	PageHeaderProps,
	"address" | "email" | "logo" | "phone" | "rightSubText" | "rightText" | "subtitle" | "title"
> & {
	containerOverrides: Array<Style>;
	fixed: boolean;
	marginBottom: number;
	noWrap: boolean;
	styles: ReturnType<typeof createPageHeaderStyles>;
	titleOverrides: Array<Style>;
	variant: "logo-left" | "minimal" | "two-column";
}) => {
	const hasRightText = Boolean(rightText || rightSubText);

	if (variant === "logo-left") {
		const containerStyles: Array<Style> = [styles.logoLeftContainer, { marginBottom }, ...containerOverrides];
		const titleStyles: Array<Style> = [styles.title, ...titleOverrides];

		return (
			<View fixed={fixed} style={containerStyles} wrap={!noWrap}>
				{logo && <View style={styles.logoContainer}>{logo}</View>}
				<View style={styles.logoContent}>
					<PDFText style={titleStyles}>{title}</PDFText>
					{subtitle && <PDFText style={styles.subtitle}>{subtitle}</PDFText>}
				</View>
				{hasRightText && (
					<View style={styles.simpleRight}>
						{rightText && <PDFText style={styles.rightText}>{rightText}</PDFText>}
						{rightSubText && <PDFText style={styles.rightSubText}>{rightSubText}</PDFText>}
					</View>
				)}
			</View>
		);
	}

	if (variant === "two-column") {
		const containerStyles: Array<Style> = [styles.twoColumnContainer, { marginBottom }, ...containerOverrides];
		const titleStyles: Array<Style> = [styles.title, ...titleOverrides];

		return (
			<View fixed={fixed} style={containerStyles} wrap={!noWrap}>
				<View style={styles.twoColumnLeft}>
					<PDFText style={titleStyles}>{title}</PDFText>
					{subtitle && <PDFText style={styles.subtitle}>{subtitle}</PDFText>}
				</View>
				{(address || phone || email) && (
					<View style={styles.twoColumnRight}>
						{address && <PDFText style={styles.contactInfo}>{address}</PDFText>}
						{phone && <PDFText style={styles.contactInfo}>{phone}</PDFText>}
						{email && <PDFText style={styles.contactInfo}>{email}</PDFText>}
					</View>
				)}
			</View>
		);
	}

	const containerStyles: Array<Style> = [styles.minimalContainer, { marginBottom }, ...containerOverrides];
	const titleStyles: Array<Style> = [styles.title, styles.titleMinimal, ...titleOverrides];

	return (
		<View fixed={fixed} style={containerStyles} wrap={!noWrap}>
			<View style={styles.minimalLeft}>
				<PDFText style={titleStyles}>{title}</PDFText>
				{subtitle && <PDFText style={styles.subtitle}>{subtitle}</PDFText>}
			</View>
			{hasRightText && (
				<View style={styles.minimalRight}>
					{rightText && <PDFText style={styles.rightText}>{rightText}</PDFText>}
					{rightSubText && <PDFText style={styles.rightSubText}>{rightSubText}</PDFText>}
				</View>
			)}
		</View>
	);
};

export const PageHeader = ({
	address,
	background,
	email,
	fixed = false,
	logo,
	marginBottom,
	noWrap = true,
	phone,
	rightSubText,
	rightText,
	style,
	subtitle,
	title,
	titleColor,
	variant = "simple",
}: PageHeaderProps) => {
	const theme = usePdfxTheme();
	const styles = useSafeMemo(() => createPageHeaderStyles(theme), [theme]);
	const mb = marginBottom ?? theme.spacing.sectionGap;

	const containerOverrides = [
		background ? { backgroundColor: resolvePdfColor(background, theme.colors) } : undefined,
		style,
	].filter((override) => override !== undefined);

	const titleOverrides: Array<Style> = [];

	if (titleColor) {
		titleOverrides.push({ color: resolvePdfColor(titleColor, theme.colors) });
	}

	if (variant === "branded") {
		const containerStyles: Array<Style> = [styles.brandedContainer, { marginBottom: mb }, ...containerOverrides];
		const titleStyles: Array<Style> = [styles.title, styles.titleBranded, styles.titleCentered, ...titleOverrides];

		return (
			<View fixed={fixed} style={containerStyles} wrap={!noWrap}>
				<PDFText style={titleStyles}>{title}</PDFText>
				{subtitle && <PDFText style={[styles.subtitle, styles.subtitleBranded]}>{subtitle}</PDFText>}
			</View>
		);
	}

	if (variant === "centered") {
		const containerStyles: Array<Style> = [styles.centeredContainer, { marginBottom: mb }, ...containerOverrides];
		const titleStyles: Array<Style> = [styles.title, styles.titleCentered, ...titleOverrides];

		return (
			<View fixed={fixed} style={containerStyles} wrap={!noWrap}>
				<PDFText style={titleStyles}>{title}</PDFText>
				{subtitle && <PDFText style={[styles.subtitle, styles.subtitleCentered]}>{subtitle}</PDFText>}
			</View>
		);
	}

	if (variant === "logo-right") {
		const containerStyles: Array<Style> = [styles.logoRightContainer, { marginBottom: mb }, ...containerOverrides];
		const titleStyles: Array<Style> = [styles.title, ...titleOverrides];

		return (
			<View fixed={fixed} style={containerStyles} wrap={!noWrap}>
				<View style={styles.logoRightContent}>
					<PDFText style={titleStyles}>{title}</PDFText>
					{subtitle && <PDFText style={styles.subtitle}>{subtitle}</PDFText>}
				</View>
				{logo && <View style={styles.logoRightLogoContainer}>{logo}</View>}
			</View>
		);
	}

	if (variant !== "simple") {
		return (
			<PageHeaderLayoutVariants
				address={address}
				containerOverrides={containerOverrides}
				email={email}
				fixed={fixed}
				logo={logo}
				marginBottom={mb}
				noWrap={noWrap}
				phone={phone}
				rightSubText={rightSubText}
				rightText={rightText}
				styles={styles}
				subtitle={subtitle}
				title={title}
				titleOverrides={titleOverrides}
				variant={variant}
			/>
		);
	}

	const containerStyles: Array<Style> = [styles.simpleContainer, { marginBottom: mb }, ...containerOverrides];
	const titleStyles: Array<Style> = [styles.title, ...titleOverrides];

	return (
		<View fixed={fixed} style={containerStyles} wrap={!noWrap}>
			<View style={styles.simpleLeft}>
				<PDFText style={titleStyles}>{title}</PDFText>
				{subtitle && <PDFText style={styles.subtitle}>{subtitle}</PDFText>}
			</View>
			{(rightText || rightSubText) && (
				<View style={styles.simpleRight}>
					{rightText && <PDFText style={styles.rightText}>{rightText}</PDFText>}
					{rightSubText && <PDFText style={styles.rightSubText}>{rightSubText}</PDFText>}
				</View>
			)}
		</View>
	);
};
