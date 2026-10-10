import { StyleSheet, Text as PDFText, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { defaultTheme, type PdfxTheme } from "../../lib/theme";

export type FormVariant = "underline" | "box" | "outlined" | "ghost";

export type FormLayout = "single" | "two-column" | "three-column";

export type FormLabelPosition = "above" | "left";

export type FormField = {
	height?: number;
	hint?: string;
	label: string;
	width?: number | string;
};

export type FormGroup = {
	fields: Array<FormField>;
	layout?: FormLayout;
	title?: string;
};

export type FormProps = {
	groups: Array<FormGroup>;
	labelPosition?: FormLabelPosition;
	noWrap?: boolean;
	style?: Style;
	subtitle?: string;
	title?: string;
	variant?: FormVariant;
};

const createFormStyles = (t: PdfxTheme, variant: FormVariant = "underline") => {
	const { borderRadius, fontWeights, spacing, typography } = t.primitives;
	const borderColor = t.colors.border;
	const rule = 1;
	const hairline = 0.75;

	const fieldAreaByVariant = {
		box: { borderColor, borderRadius: borderRadius.sm, borderStyle: "solid", borderWidth: hairline },
		ghost: { backgroundColor: t.colors.muted, borderRadius: borderRadius.sm },
		outlined: {
			borderColor: t.colors.foreground,
			borderRadius: borderRadius.md,
			borderStyle: "solid",
			borderWidth: hairline,
		},
		underline: { borderBottomColor: borderColor, borderBottomStyle: "solid", borderBottomWidth: 1 },
	} satisfies Record<FormVariant, Style>;

	const hasPadding = variant === "box" || variant === "outlined" || variant === "ghost";

	return StyleSheet.create({
		column: { flex: 1 },
		columnsRow: { flexDirection: "row", gap: spacing[4] },
		fieldAbove: { marginBottom: spacing[3], width: "100%" },
		fieldArea: { width: "100%" as const, ...fieldAreaByVariant[variant] },
		fieldLeft: { alignItems: "flex-end", flexDirection: "row", gap: spacing[2], marginBottom: spacing[3] },
		fieldLeftArea: { flex: 1 },
		formDivider: {
			borderBottomColor: borderColor,
			borderBottomStyle: "solid",
			borderBottomWidth: rule,
			marginBottom: spacing[4],
		},
		formSubtitle: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: typography.sm,
			lineHeight: t.typography.body.lineHeight,
			marginBottom: spacing[3],
		},
		formTitle: {
			color: t.colors.foreground,
			fontFamily: t.typography.heading.fontFamily,
			fontSize: typography.xl,
			fontWeight: fontWeights.bold,
			lineHeight: t.typography.heading.lineHeight,
			marginBottom: spacing[1],
		},
		group: { marginBottom: spacing[5] },
		groupTitle: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: typography.xs,
			fontWeight: fontWeights.semibold,
			letterSpacing: 0.8,
			lineHeight: 1.2,
			marginBottom: spacing[3],
			textTransform: "uppercase",
		},
		hint: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: typography.xs,
			opacity: 0.14,
			paddingBottom: hasPadding ? spacing[1] : 0,
			paddingHorizontal: hasPadding ? spacing[2] : 0,
			paddingTop: hasPadding ? spacing[1] : spacing[0.5],
		},
		labelAbove: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: typography.xs,
			fontWeight: fontWeights.medium,
			letterSpacing: 0.5,
			lineHeight: 1.2,
			marginBottom: spacing[1],
			textTransform: "uppercase",
		},
		labelLeft: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.typography.body.fontSize,
			fontWeight: fontWeights.medium,
			lineHeight: t.typography.body.lineHeight,
			paddingBottom: hasPadding ? spacing[1] : 0,
			width: 80,
		},
		root: { marginBottom: t.spacing.componentGap, width: "100%" },
	});
};

const renderFieldAbove = (field: FormField, idx: number, styles: ReturnType<typeof createFormStyles>) => {
	const areaStyle: Array<Style> = [styles.fieldArea, { minHeight: field.height ?? 18 }];

	return (
		<View key={`${field.label}-${idx}`} style={styles.fieldAbove}>
			<PDFText style={styles.labelAbove}>{field.label}</PDFText>
			<View style={areaStyle}>{field.hint ? <PDFText style={styles.hint}>{field.hint}</PDFText> : null}</View>
		</View>
	);
};

const renderFieldLeft = (field: FormField, idx: number, styles: ReturnType<typeof createFormStyles>) => {
	const areaStyle: Array<Style> = [styles.fieldArea, styles.fieldLeftArea, { minHeight: field.height ?? 18 }];

	return (
		<View key={`${field.label}-${idx}`} style={styles.fieldLeft}>
			<PDFText style={styles.labelLeft}>{field.label}</PDFText>
			<View style={areaStyle}>{field.hint ? <PDFText style={styles.hint}>{field.hint}</PDFText> : null}</View>
		</View>
	);
};

const renderGroup = (
	group: FormGroup,
	gi: number,
	styles: ReturnType<typeof createFormStyles>,
	labelPosition: "above" | "left"
) => {
	const layout: FormLayout = group.layout ?? "single";
	const colsReference = { value: 1 };

	if (layout === "three-column") {
		colsReference.value = 3;
	} else if (layout === "two-column") {
		colsReference.value = 2;
	}

	const renderField = (field: FormField, idx: number) =>
		labelPosition === "left" ? renderFieldLeft(field, idx, styles) : renderFieldAbove(field, idx, styles);

	if (colsReference.value === 1) {
		return (
			<View key={`group-${gi}`} style={styles.group}>
				{group.title ? <PDFText style={styles.groupTitle}>{group.title}</PDFText> : null}
				{group.fields.map(renderField)}
			</View>
		);
	}

	const chunkSize = Math.ceil(group.fields.length / colsReference.value);
	const chunks: Array<Array<FormField>> = [];

	for (const iReference = { value: 0 }; iReference.value < group.fields.length; iReference.value += chunkSize) {
		chunks.push(group.fields.slice(iReference.value, iReference.value + chunkSize));
	}

	while (chunks.length < colsReference.value) {
		chunks.push([]);
	}

	return (
		<View key={`group-${gi}`} style={styles.group}>
			{group.title ? <PDFText style={styles.groupTitle}>{group.title}</PDFText> : null}
			<View style={styles.columnsRow}>
				{chunks.map((chunk, ci) => (
					<View key={`col-${gi}-${chunk[0]?.label ?? ci}`} style={styles.column}>
						{chunk.map(renderField)}
					</View>
				))}
			</View>
		</View>
	);
};

export const Form = ({
	groups,
	labelPosition = "above",
	noWrap = false,
	style,
	subtitle,
	title,
	variant = "underline",
}: FormProps) => {
	const theme = defaultTheme;
	const styles = createFormStyles(theme, variant);
	const rootStyles: Array<Style> = [styles.root];

	if (style) {
		rootStyles.push(style);
	}

	const inner = (
		<View style={rootStyles}>
			{title ? <PDFText style={styles.formTitle}>{title}</PDFText> : null}
			{subtitle ? <PDFText style={styles.formSubtitle}>{subtitle}</PDFText> : null}
			{title || subtitle ? <View style={styles.formDivider} /> : null}
			{groups.map((group, gi) => renderGroup(group, gi, styles, labelPosition))}
		</View>
	);

	return noWrap ? <View wrap={false}>{inner}</View> : inner;
};
