import { Image, Text as PDFText, StyleSheet, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { defaultTheme, type PdfxTheme } from "../../lib/theme";

export type PdfImageHTTPMethod = "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "PATCH";

export type PdfImageSrc =
	| string
	| { body?: string; headers?: Record<string, string>; method?: PdfImageHTTPMethod; uri: string };

export type PdfImageFit = "cover" | "contain" | "fill" | "none";

export type PdfImageVariant = "default" | "full-width" | "thumbnail" | "avatar" | "cover" | "bordered" | "rounded";

export type PdfImageProps = {
	aspectRatio?: number;
	borderRadius?: number;
	caption?: string;
	fit?: PdfImageFit;
	height?: number | string;
	noWrap?: boolean;
	position?: string;
	src: PdfImageSrc;
	style?: Style;
	variant?: PdfImageVariant;
	width?: number | string;
};

type VariantDefaults = { borderRadius?: number; fit: PdfImageFit; height?: number | string; width?: number | string };

const VARIANT_DEFAULTS = {
	avatar: { borderRadius: 999, fit: "cover", height: 48, width: 48 },
	bordered: { fit: "contain", width: "100%" },
	cover: { fit: "cover", height: 160, width: "100%" },
	default: { fit: "contain" },
	"full-width": { fit: "cover", width: "100%" },
	rounded: { borderRadius: 8, fit: "contain", width: 200 },
	thumbnail: { fit: "cover", height: 80, width: 80 },
} satisfies Record<PdfImageVariant, VariantDefaults>;

const createImageStyles = (t: PdfxTheme) => {
	const { spacing } = t.primitives;

	return StyleSheet.create({
		caption: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.primitives.typography.xs,
			marginTop: spacing[1],
			textAlign: "center",
		},
		container: { flexDirection: "column" },
		image: {},
		imageBordered: { borderColor: t.colors.border, borderStyle: "solid", borderWidth: 1 },
	});
};

export const PdfImage = ({
	aspectRatio,
	borderRadius,
	caption,
	fit,
	height,
	noWrap = true,
	position = "50% 50%",
	src,
	style,
	variant = "default",
	width,
}: PdfImageProps) => {
	const theme = defaultTheme;
	const styles = createImageStyles(theme);
	const defaults = { borderRadius: undefined, height: undefined, width: undefined, ...VARIANT_DEFAULTS[variant] };
	const resolvedWidth = width ?? defaults.width;

	const resolvedHeight: number | string | undefined = (() => {
		if (height !== undefined) {
			return height;
		}

		if (defaults.height !== undefined) {
			return defaults.height;
		}

		if (aspectRatio !== undefined && Object.prototype.toString.call(resolvedWidth) === "[object Number]") {
			return Number(resolvedWidth) / aspectRatio;
		}

		return undefined;
	})();

	const resolvedFit = fit ?? defaults.fit;
	const resolvedRadius = borderRadius ?? defaults.borderRadius;
	const imageStyles: Array<Style> = [styles.image];

	if (resolvedWidth !== undefined) {
		imageStyles.push({ width: resolvedWidth });
	}

	if (resolvedHeight !== undefined) {
		imageStyles.push({ height: resolvedHeight });
	}

	imageStyles.push({ objectFit: resolvedFit, objectPosition: position });

	if (resolvedRadius !== undefined) {
		imageStyles.push({ borderRadius: resolvedRadius });
	}

	if (variant === "bordered") {
		imageStyles.push(styles.imageBordered);
	}

	if (style) {
		imageStyles.push(style);
	}

	const content = (
		<View style={styles.container}>
			<Image src={src} style={imageStyles} />
			{caption ? <PDFText style={styles.caption}>{caption}</PDFText> : null}
		</View>
	);

	return noWrap ? <View wrap={false}>{content}</View> : content;
};
