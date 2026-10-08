import { Text as PDFText, StyleSheet, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { usePdfxTheme, useSafeMemo } from "../../lib/theme-context";
import { resolvePdfColor } from "./utils/color";

type PdfxTheme = ReturnType<typeof usePdfxTheme>;

export type PageFooterVariant = "simple" | "centered" | "branded" | "minimal" | "three-column" | "detailed";

export type PageFooterProps = {
	address?: string;
	background?: string;
	centerText?: string;
	email?: string;
	fixed?: boolean;
	leftText?: string;
	marginTop?: number;
	noWrap?: boolean;
	pagePadding?: number;
	phone?: string;
	rightText?: string;
	sticky?: boolean;
	style?: Style;
	textColor?: string;
	variant?: PageFooterVariant;
	website?: string;
};

const createPageFooterStyles = (t: PdfxTheme) => {
	const { fontWeights, spacing } = t.primitives;
	const c = t.colors;
	const { body } = t.typography;

	const textBase = {
		color: c.mutedForeground,
		fontFamily: body.fontFamily,
		fontSize: t.primitives.typography.xs,
		lineHeight: body.lineHeight,
	};

	return StyleSheet.create({
		brandedContainer: {
			alignItems: "center",
			backgroundColor: c.primary,
			display: "flex",
			flexDirection: "row",
			justifyContent: "space-between",
			paddingHorizontal: spacing[4],
			paddingVertical: spacing[3],
		},
		centeredContainer: {
			alignItems: "center",
			borderTopColor: c.border,
			borderTopStyle: "solid",
			borderTopWidth: spacing[0.5],
			display: "flex",
			flexDirection: "column",
			paddingTop: spacing[3],
		},
		companyBold: { ...textBase, color: c.foreground, fontWeight: fontWeights.bold },
		companyName: { ...textBase, color: c.foreground, fontWeight: fontWeights.medium },
		contactInfoCenter: {
			...textBase,
			fontSize: t.primitives.typography.xs - 1,
			marginTop: spacing[0.5],
			textAlign: "center",
		},
		detailedContainer: {
			borderTopColor: c.border,
			borderTopStyle: "solid",
			borderTopWidth: spacing[1],
			display: "flex",
			flexDirection: "column",
			paddingTop: spacing[3],
		},
		detailedLeft: { display: "flex", flex: 1, flexDirection: "column" },
		detailedPageNumber: {
			...textBase,
			borderTopColor: c.border,
			borderTopStyle: "solid",
			borderTopWidth: spacing[0.5],
			paddingTop: spacing[2],
			textAlign: "center",
		},
		detailedRight: { alignItems: "flex-end", display: "flex", flexDirection: "column" },
		detailedTopRow: {
			alignItems: "flex-start",
			display: "flex",
			flexDirection: "row",
			justifyContent: "space-between",
			marginBottom: spacing[2],
		},
		minimalContainer: {
			alignItems: "center",
			display: "flex",
			flexDirection: "row",
			justifyContent: "space-between",
			paddingBottom: spacing[1],
			paddingTop: spacing[1],
		},
		simpleContainer: {
			alignItems: "center",
			borderTopColor: c.border,
			borderTopStyle: "solid",
			borderTopWidth: spacing[0.5],
			display: "flex",
			flexDirection: "row",
			justifyContent: "space-between",
			paddingTop: spacing[3],
		},
		textBranded: { ...textBase, color: c.primaryForeground, fontWeight: fontWeights.medium },
		textBrandedRight: { ...textBase, color: c.primaryForeground, textAlign: "right" },
		textCenter: { ...textBase, flex: 1, textAlign: "center" },
		textCenteredVariant: { ...textBase, marginBottom: spacing[1], textAlign: "center" },
		textLeft: { ...textBase, flex: 1 },
		textRight: { ...textBase, textAlign: "right" },
		threeColumnCenter: { alignItems: "center", display: "flex", flex: 1, flexDirection: "column" },
		threeColumnContainer: {
			alignItems: "flex-start",
			borderTopColor: c.border,
			borderTopStyle: "solid",
			borderTopWidth: spacing[0.5],
			display: "flex",
			flexDirection: "row",
			justifyContent: "space-between",
			paddingTop: spacing[3],
		},
		threeColumnLeft: { display: "flex", flex: 1, flexDirection: "column" },
		threeColumnRight: { alignItems: "flex-end", display: "flex", flex: 1, flexDirection: "column" },
	});
};

const PageFooterDetailedVariants = ({
	address,
	applyOverrides,
	email,
	isFixed,
	leftText,
	marginTop,
	noWrap,
	phone,
	resolvedTextColor,
	rightText,
	styles,
	variant,
	website,
}: Pick<PageFooterProps, "address" | "email" | "leftText" | "phone" | "rightText" | "website"> & {
	applyOverrides: (base: Array<Style>) => Array<Style>;
	isFixed: boolean;
	marginTop: number;
	noWrap: boolean;
	resolvedTextColor?: string;
	styles: ReturnType<typeof createPageFooterStyles>;
	variant: "detailed" | "three-column";
}) => {
	if (variant === "three-column") {
		const containerStyles = applyOverrides([styles.threeColumnContainer, { marginTop }]);
		const leftStyle: Array<Style> = [styles.companyName];
		const centerStyle: Array<Style> = [styles.contactInfoCenter];
		const rightStyle: Array<Style> = [styles.textRight];

		if (resolvedTextColor) {
			leftStyle.push({ color: resolvedTextColor });
			centerStyle.push({ color: resolvedTextColor });
			rightStyle.push({ color: resolvedTextColor });
		}

		return (
			<View fixed={isFixed} style={containerStyles} wrap={!noWrap}>
				<View style={styles.threeColumnLeft}>
					{leftText && <PDFText style={leftStyle}>{leftText}</PDFText>}
					{address && <PDFText style={styles.textLeft}>{address}</PDFText>}
				</View>
				<View style={styles.threeColumnCenter}>
					{phone && <PDFText style={centerStyle}>{phone}</PDFText>}
					{email && <PDFText style={centerStyle}>{email}</PDFText>}
					{website && <PDFText style={centerStyle}>{website}</PDFText>}
				</View>
				<View style={styles.threeColumnRight}>
					{rightText && <PDFText style={rightStyle}>{rightText}</PDFText>}
				</View>
			</View>
		);
	}

	const containerStyles = applyOverrides([styles.detailedContainer, { marginTop }]);
	const companyStyle: Array<Style> = [styles.companyBold];
	const addressStyle: Array<Style> = [styles.textLeft];
	const contactStyle: Array<Style> = [styles.textRight];
	const pageNumberStyle: Array<Style> = [styles.detailedPageNumber];

	if (resolvedTextColor) {
		companyStyle.push({ color: resolvedTextColor });
		addressStyle.push({ color: resolvedTextColor });
		contactStyle.push({ color: resolvedTextColor });
		pageNumberStyle.push({ color: resolvedTextColor });
	}

	return (
		<View fixed={isFixed} style={containerStyles} wrap={!noWrap}>
			<View style={styles.detailedTopRow}>
				<View style={styles.detailedLeft}>
					{leftText && <PDFText style={companyStyle}>{leftText}</PDFText>}
					{address && <PDFText style={addressStyle}>{address}</PDFText>}
				</View>
				<View style={styles.detailedRight}>
					{phone && <PDFText style={contactStyle}>{`Phone: ${phone}`}</PDFText>}
					{email && <PDFText style={contactStyle}>{`Email: ${email}`}</PDFText>}
					{website && <PDFText style={contactStyle}>{`Web: ${website}`}</PDFText>}
				</View>
			</View>
			{rightText && <PDFText style={pageNumberStyle}>{rightText}</PDFText>}
		</View>
	);
};

const PageFooterStandardVariants = ({
	applyOverrides,
	centerText,
	isFixed,
	leftText,
	marginTop,
	noWrap,
	resolvedTextColor,
	rightText,
	styles,
	variant,
}: Pick<PageFooterProps, "centerText" | "leftText" | "rightText"> & {
	applyOverrides: (base: Array<Style>) => Array<Style>;
	isFixed: boolean;
	marginTop: number;
	noWrap: boolean;
	resolvedTextColor?: string;
	styles: ReturnType<typeof createPageFooterStyles>;
	variant: Exclude<PageFooterVariant, "detailed" | "three-column">;
}) => {
	if (variant === "branded") {
		const containerStyles = applyOverrides([styles.brandedContainer, { marginTop }]);
		const leftStyle: Array<Style> = [styles.textBranded];
		const rightStyle: Array<Style> = [styles.textBrandedRight];

		if (resolvedTextColor) {
			leftStyle.push({ color: resolvedTextColor });
			rightStyle.push({ color: resolvedTextColor });
		}

		return (
			<View fixed={isFixed} style={containerStyles} wrap={!noWrap}>
				{leftText && <PDFText style={leftStyle}>{leftText}</PDFText>}
				{rightText && <PDFText style={rightStyle}>{rightText}</PDFText>}
			</View>
		);
	}

	if (variant === "centered") {
		const containerStyles = applyOverrides([styles.centeredContainer, { marginTop }]);
		const textStyle: Array<Style> = [styles.textCenteredVariant];

		if (resolvedTextColor) {
			textStyle.push({ color: resolvedTextColor });
		}

		return (
			<View fixed={isFixed} style={containerStyles} wrap={!noWrap}>
				{leftText && <PDFText style={textStyle}>{leftText}</PDFText>}
				{rightText && <PDFText style={textStyle}>{rightText}</PDFText>}
			</View>
		);
	}

	if (variant === "minimal") {
		const containerStyles = applyOverrides([styles.minimalContainer, { marginTop }]);
		const leftStyle: Array<Style> = [styles.textLeft];
		const rightStyle: Array<Style> = [styles.textRight];

		if (resolvedTextColor) {
			leftStyle.push({ color: resolvedTextColor });
			rightStyle.push({ color: resolvedTextColor });
		}

		return (
			<View fixed={isFixed} style={containerStyles} wrap={!noWrap}>
				{leftText && <PDFText style={leftStyle}>{leftText}</PDFText>}
				{rightText && <PDFText style={rightStyle}>{rightText}</PDFText>}
			</View>
		);
	}

	const containerStyles = applyOverrides([styles.simpleContainer, { marginTop }]);
	const leftStyle: Array<Style> = [styles.textLeft];
	const centerStyle: Array<Style> = [styles.textCenter];
	const rightStyle: Array<Style> = [styles.textRight];

	if (resolvedTextColor) {
		leftStyle.push({ color: resolvedTextColor });
		centerStyle.push({ color: resolvedTextColor });
		rightStyle.push({ color: resolvedTextColor });
	}

	return (
		<View fixed={isFixed} style={containerStyles} wrap={!noWrap}>
			{leftText && <PDFText style={leftStyle}>{leftText}</PDFText>}
			{centerText && <PDFText style={centerStyle}>{centerText}</PDFText>}
			{rightText && <PDFText style={rightStyle}>{rightText}</PDFText>}
		</View>
	);
};

export const PageFooter = ({
	address,
	background,
	centerText,
	email,
	fixed = false,
	leftText,
	marginTop,
	noWrap = true,
	pagePadding = 0,
	phone,
	rightText,
	sticky = false,
	style,
	textColor,
	variant = "simple",
	website,
}: PageFooterProps) => {
	const theme = usePdfxTheme();
	const styles = useSafeMemo(() => createPageFooterStyles(theme), [theme]);
	const isFixed = fixed || sticky;
	const mt = sticky ? 0 : (marginTop ?? theme.spacing.sectionGap);
	const resolvedTextColor = textColor ? resolvePdfColor(textColor, theme.colors) : undefined;

	const stickyStyle: Style = sticky
		? { bottom: pagePadding, left: pagePadding, position: "absolute", right: pagePadding }
		: {};

	const applyOverrides = (base: Array<Style>): Array<Style> => {
		if (background) {
			base.push({ backgroundColor: resolvePdfColor(background, theme.colors) });
		}

		if (style) {
			base.push(style);
		}

		if (sticky) {
			base.push(stickyStyle);
		}

		return base;
	};

	if (variant === "three-column" || variant === "detailed") {
		return (
			<PageFooterDetailedVariants
				address={address}
				applyOverrides={applyOverrides}
				email={email}
				isFixed={isFixed}
				leftText={leftText}
				marginTop={mt}
				noWrap={noWrap}
				phone={phone}
				resolvedTextColor={resolvedTextColor}
				rightText={rightText}
				styles={styles}
				variant={variant}
				website={website}
			/>
		);
	}

	return (
		<PageFooterStandardVariants
			applyOverrides={applyOverrides}
			centerText={centerText}
			isFixed={isFixed}
			leftText={leftText}
			marginTop={mt}
			noWrap={noWrap}
			resolvedTextColor={resolvedTextColor}
			rightText={rightText}
			styles={styles}
			variant={variant}
		/>
	);
};
