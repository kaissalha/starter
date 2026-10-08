import type { ReactNode } from "react";

import { Circle, Line, Text as PDFText, Path, StyleSheet, Svg, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { usePdfxTheme, useSafeMemo } from "../../lib/theme-context";

type PdfxTheme = ReturnType<typeof usePdfxTheme>;

export type AlertVariant = "info" | "success" | "warning" | "error";

export type AlertProps = {
	children?: ReactNode;
	showBorder?: boolean;
	showIcon?: boolean;
	style?: Style;
	title?: string;
	variant?: AlertVariant;
};

const ICON_STROKE_WIDTH = 1.5;

const SvgWrap = ({ children }: { children: ReactNode }) => (
	<Svg height={16} viewBox='0 0 16 16' width={16}>
		{children}
	</Svg>
);

const ICON_MAP = {
	error: ({ color }: { color: string }) => (
		<SvgWrap>
			<Circle cx={8} cy={8} fill='none' r={7} stroke={color} strokeWidth={ICON_STROKE_WIDTH} />
			<Line
				stroke={color}
				strokeLinecap='round'
				strokeWidth={ICON_STROKE_WIDTH}
				x1={5.5}
				x2={10.5}
				y1={5.5}
				y2={10.5}
			/>
			<Line
				stroke={color}
				strokeLinecap='round'
				strokeWidth={ICON_STROKE_WIDTH}
				x1={10.5}
				x2={5.5}
				y1={5.5}
				y2={10.5}
			/>
		</SvgWrap>
	),
	info: ({ color }: { color: string }) => (
		<SvgWrap>
			<Circle cx={8} cy={8} fill='none' r={7} stroke={color} strokeWidth={ICON_STROKE_WIDTH} />
			<Circle cx={8} cy={4.5} fill={color} r={1} />
			<Line stroke={color} strokeLinecap='round' strokeWidth={ICON_STROKE_WIDTH} x1={8} x2={8} y1={7} y2={11.5} />
		</SvgWrap>
	),
	success: ({ color }: { color: string }) => (
		<SvgWrap>
			<Circle cx={8} cy={8} fill='none' r={7} stroke={color} strokeWidth={ICON_STROKE_WIDTH} />
			<Path
				d='M5 8 L7 10 L11 6'
				fill='none'
				stroke={color}
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={ICON_STROKE_WIDTH}
			/>
		</SvgWrap>
	),
	warning: ({ color }: { color: string }) => (
		<SvgWrap>
			<Path
				d='M8 1.5 L15 14.5 L1 14.5 Z'
				fill='none'
				stroke={color}
				strokeLinejoin='round'
				strokeWidth={ICON_STROKE_WIDTH}
			/>
			<Line stroke={color} strokeLinecap='round' strokeWidth={ICON_STROKE_WIDTH} x1={8} x2={8} y1={6} y2={10} />
			<Circle cx={8} cy={12.5} fill={color} r={0.75} />
		</SvgWrap>
	),
};

const AlertIcon = ({ color, variant }: { color: string; variant: AlertVariant }) => {
	const Icon = ICON_MAP[variant];

	return <Icon color={color} />;
};

const createAlertStyles = (theme: PdfxTheme) => {
	const { colors, primitives, typography } = theme;

	const variantColors = {
		error: colors.destructive,
		info: colors.info,
		success: colors.success,
		warning: colors.warning,
	} satisfies Record<AlertVariant, string>;

	const bl = (color: string) => ({ borderLeftColor: color, borderLeftWidth: 4 });

	const sheet = StyleSheet.create({
		bg: { backgroundColor: colors.muted },
		borderError: bl(variantColors.error),
		borderInfo: bl(variantColors.info),
		borderSuccess: bl(variantColors.success),
		borderWarning: bl(variantColors.warning),
		container: { borderRadius: 4, flexDirection: "row", marginBottom: theme.spacing.componentGap, padding: 12 },
		contentContainer: { flex: 1 },
		description: {
			color: colors.mutedForeground,
			fontFamily: typography.body.fontFamily,
			fontSize: primitives.typography.sm,
			lineHeight: typography.body.lineHeight,
		},
		iconContainer: {
			alignItems: "center",
			justifyContent: "flex-start",
			marginRight: 10,
			paddingTop: 2,
			width: 20,
		},
		title: {
			color: colors.foreground,
			fontFamily: typography.heading.fontFamily,
			fontSize: primitives.typography.sm,
			fontWeight: primitives.fontWeights.semibold,
			marginBottom: 4,
		},
	});

	return {
		...sheet,
		borderMap: {
			error: sheet.borderError,
			info: sheet.borderInfo,
			success: sheet.borderSuccess,
			warning: sheet.borderWarning,
		} satisfies Record<AlertVariant, Style>,
		variantColors,
	};
};

export const Alert = ({ children, showBorder = true, showIcon = true, style, title, variant = "info" }: AlertProps) => {
	const theme = usePdfxTheme();
	const styles = useSafeMemo(() => createAlertStyles(theme), [theme]);

	if (!title && !children) {
		return null;
	}

	const containerStyles: Array<Style> = [
		styles.container,
		styles.bg,
		...(showBorder ? [styles.borderMap[variant]] : []),
		...(style ? [style].flat() : []),
	];

	return (
		<View style={containerStyles} wrap={false}>
			{showIcon && (
				<View style={styles.iconContainer}>
					<AlertIcon color={styles.variantColors[variant]} variant={variant} />
				</View>
			)}
			<View style={styles.contentContainer}>
				{title && <PDFText style={styles.title}>{title}</PDFText>}
				{Object.prototype.toString.call(children) === "[object String]" ? (
					<PDFText style={styles.description}>{String(children)}</PDFText>
				) : (
					children
				)}
			</View>
		</View>
	);
};
