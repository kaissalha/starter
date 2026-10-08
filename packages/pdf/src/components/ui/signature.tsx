import { Text as PDFText, StyleSheet, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { usePdfxTheme, useSafeMemo } from "../../lib/theme-context";

type PdfxTheme = ReturnType<typeof usePdfxTheme>;

export type SignatureVariant = "single" | "double" | "inline";

export type SignatureSigner = {
	date?: string;
	label?: string;
	name?: string;
	title?: string;
};

export type SignatureProps = {
	date?: string;
	label?: string;
	name?: string;
	signers?: [SignatureSigner, SignatureSigner];
	style?: Style;
	title?: string;
	variant?: SignatureVariant;
};

const createSignatureStyles = (t: PdfxTheme) => {
	const { fontWeights, spacing, typography } = t.primitives;

	return StyleSheet.create({
		block: { flex: 1, minWidth: 140 },
		container: { marginBottom: t.spacing.componentGap, marginTop: t.spacing.sectionGap },
		dateText: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: typography.xs,
			marginTop: 1,
		},
		doubleRow: { flexDirection: "row", gap: spacing[8], justifyContent: "space-between" },
		inlineLabel: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: typography.sm,
		},
		inlineLine: {
			borderBottomColor: t.colors.foreground,
			borderBottomStyle: "solid",
			borderBottomWidth: 1,
			height: spacing[5],
			minWidth: 120,
			paddingHorizontal: spacing[2],
		},
		inlineName: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.typography.body.fontSize,
		},
		inlineRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing[3] },
		label: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: typography.sm,
			marginBottom: spacing[1],
		},
		line: {
			borderBottomColor: t.colors.foreground,
			borderBottomStyle: "solid",
			borderBottomWidth: 1,
			marginBottom: spacing[1],
			minHeight: spacing[6],
		},
		name: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.typography.body.fontSize,
			fontWeight: fontWeights.semibold,
		},
		titleText: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: typography.sm,
		},
	});
};

const renderSignerBlock = (signer: SignatureSigner, styles: ReturnType<typeof createSignatureStyles>) => (
	<View style={styles.block}>
		{signer.label ? <PDFText style={styles.label}>{signer.label}</PDFText> : null}
		<View style={styles.line} />
		{signer.name ? <PDFText style={styles.name}>{signer.name}</PDFText> : null}
		{signer.title ? <PDFText style={styles.titleText}>{signer.title}</PDFText> : null}
		{signer.date ? <PDFText style={styles.dateText}>{signer.date}</PDFText> : null}
	</View>
);

export const Signature = ({
	date,
	label = "Signature",
	name,
	signers,
	style,
	title,
	variant = "single",
}: SignatureProps) => {
	const theme = usePdfxTheme();
	const styles = useSafeMemo(() => createSignatureStyles(theme), [theme]);
	const containerStyles: Array<Style> = [styles.container];

	if (style) {
		containerStyles.push(style);
	}

	if (variant === "inline") {
		return (
			<View style={containerStyles} wrap={false}>
				<View style={styles.inlineRow}>
					<PDFText style={styles.inlineLabel}>{`${label}:`}</PDFText>
					<View style={styles.inlineLine} />
					{name ? <PDFText style={styles.inlineName}>{name}</PDFText> : null}
				</View>
			</View>
		);
	}

	if (variant === "double") {
		const [first, second] = signers ?? [
			{ date: "", label: "Authorized by", name: "", title: "" },
			{ date: "", label: "Approved by", name: "", title: "" },
		];

		return (
			<View style={containerStyles} wrap={false}>
				<View style={styles.doubleRow}>
					{renderSignerBlock(first, styles)}
					{renderSignerBlock(second, styles)}
				</View>
			</View>
		);
	}

	return (
		<View style={containerStyles} wrap={false}>
			{renderSignerBlock({ date, label, name, title }, styles)}
		</View>
	);
};
