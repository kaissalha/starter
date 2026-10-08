export type PdfxTheme = {
	colors: {
		accent: string;
		background: string;
		border: string;
		destructive: string;
		foreground: string;
		info: string;
		muted: string;
		mutedForeground: string;
		primary: string;
		primaryForeground: string;
		success: string;
		successForeground: string;
		warning: string;
		warningForeground: string;
	};
	primitives: {
		borderRadius: { full: number; md: number; sm: number };
		fontWeights: { bold: number; medium: number; regular: number; semibold: number };
		letterSpacing: { normal: number; tight: number; wide: number; wider: number };
		lineHeights: { normal: number };
		spacing: Record<number, number>;
		typography: { "2xl": number; "3xl": number; base: number; lg: number; sm: number; xl: number; xs: number };
	};
	spacing: {
		componentGap: number;
		page: { marginBottom: number; marginLeft: number; marginRight: number; marginTop: number };
		paragraphGap: number;
		sectionGap: number;
	};
	typography: {
		body: { fontFamily: string; fontSize: number; lineHeight: number };
		heading: {
			fontFamily: string;
			fontSize: { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number };
			fontWeight: number;
			lineHeight: number;
		};
	};
};

export const defaultTheme: PdfxTheme = {
	colors: {
		accent: "#6F6F6F",
		background: "#FFFFFF",
		border: "#E4E4E8",
		destructive: "#DC2626",
		foreground: "#0A0A0A",
		info: "#2563EB",
		muted: "#F5F5F0",
		mutedForeground: "#6F6F6F",
		primary: "#141414",
		primaryForeground: "#FAFAFA",
		success: "#16A34A",
		successForeground: "#166534",
		warning: "#CA8A04",
		warningForeground: "#B45309",
	},
	primitives: {
		borderRadius: { full: 9999, md: 4, sm: 2 },
		fontWeights: { bold: 700, medium: 500, regular: 400, semibold: 600 },
		letterSpacing: { normal: 0, tight: -0.02, wide: 0.02, wider: 0.04 },
		lineHeights: { normal: 1.6 },
		spacing: { 0: 0, 0.5: 2, 1: 4, 12: 48, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 },
		typography: { "2xl": 18, "3xl": 22, base: 10, lg: 12, sm: 9, xl: 14, xs: 8 },
	},
	spacing: {
		componentGap: 14,
		page: { marginBottom: 40, marginLeft: 40, marginRight: 40, marginTop: 40 },
		paragraphGap: 8,
		sectionGap: 24,
	},
	typography: {
		body: { fontFamily: "Geist", fontSize: 10, lineHeight: 1.6 },
		heading: {
			fontFamily: "Geist",
			fontSize: { h1: 22, h2: 18, h3: 14, h4: 12, h5: 10, h6: 9 },
			fontWeight: 600,
			lineHeight: 1.25,
		},
	},
};
