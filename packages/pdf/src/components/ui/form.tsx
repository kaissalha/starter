import { Text as PDFText, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { usePdfxTheme, useSafeMemo } from "../../lib/theme-context";
import { createFormStyles } from "./form-styles";
import type { FormLayout, FormField, FormGroup, FormProps } from "./form-types";

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
	const theme = usePdfxTheme();
	const styles = useSafeMemo(() => createFormStyles(theme, variant), [theme, variant]);
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
